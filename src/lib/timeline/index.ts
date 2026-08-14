import prisma from '@/lib/db';
import { NormalizedEvent } from '@prisma/client';
import { nextDate, zonedDateTime } from '@/lib/time';

export interface TimeSegment {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  events: NormalizedEvent[];
  isCalendarAnchored: boolean;
  isGap: boolean;
}

export interface TimelineOptions {
  userId: string;
  date: string; // YYYY-MM-DD
  timezone?: string;
  workingHoursStart?: string; // "09:00"
  workingHoursEnd?: string;   // "17:30"
  eventsInput?: NormalizedEvent[];
}

/**
 * Reconstructs a timeline of TimeSegments for a given user and date.
 */
export async function generateTimeSegments(options: TimelineOptions): Promise<TimeSegment[]> {
  const {
    userId,
    date,
    timezone = 'UTC',
    workingHoursStart = '09:00',
    workingHoursEnd = '17:30',
    eventsInput,
  } = options;

  let events: NormalizedEvent[];

  if (eventsInput) {
    events = eventsInput;
  } else {
    const dayStart = zonedDateTime(date, '00:00', timezone);
    const dayEnd = zonedDateTime(nextDate(date), '00:00', timezone);

    events = await prisma.normalizedEvent.findMany({
      where: {
        userId,
        occurredAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      orderBy: { occurredAt: 'asc' },
    });
  }

  const defaultWorkdayStart = zonedDateTime(date, workingHoursStart, timezone);
  let defaultWorkdayEnd = zonedDateTime(date, workingHoursEnd, timezone);

  if (defaultWorkdayEnd <= defaultWorkdayStart) {
    // Fallback if end <= start
    defaultWorkdayEnd = new Date(defaultWorkdayStart.getTime() + 8.5 * 3600 * 1000);
  }

  // 1. Separate calendar anchor events from non-calendar events
  const calendarEvents = events.filter(
    (e) => e.eventType === 'calendar_event' || e.provider === 'google_calendar'
  );
  const nonCalendarEvents = events
    .filter((e) => e.eventType !== 'calendar_event' && e.provider !== 'google_calendar')
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  // 2. Build calendar anchor slots
  const anchorSlots: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }> = [];

  for (const calEvent of calendarEvents) {
    const start = new Date(calEvent.occurredAt);
    let end: Date;
    if (calEvent.endedAt) {
      end = new Date(calEvent.endedAt);
    } else if (calEvent.duration) {
      end = new Date(start.getTime() + calEvent.duration * 60000);
    } else {
      end = new Date(start.getTime() + 30 * 60000); // 30m default
    }

    if (end <= start) {
      end = new Date(start.getTime() + 30 * 60000);
    }

    anchorSlots.push({
      startTime: start,
      endTime: end,
      events: [calEvent],
    });
  }

  // Sort calendar anchors
  anchorSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Overlapping calendar events are one occupied interval, not duplicated work time.
  const mergedCalendarAnchors: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }> = [];
  for (const anchor of anchorSlots) {
    const previous = mergedCalendarAnchors[mergedCalendarAnchors.length - 1];
    if (previous && anchor.startTime <= previous.endTime) {
      previous.endTime = new Date(Math.max(previous.endTime.getTime(), anchor.endTime.getTime()));
      previous.events.push(...anchor.events);
    } else {
      mergedCalendarAnchors.push(anchor);
    }
  }

  // 3. Cluster non-calendar events occurring within 15 mins of each other
  const clusters: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }> = [];
  const FIFTEEN_MINS_MS = 15 * 60 * 1000;
  const FIVE_MINS_MS = 5 * 60 * 1000;

  let currentCluster: NormalizedEvent[] = [];

  for (const ev of nonCalendarEvents) {
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
    } else {
      const lastEv = currentCluster[currentCluster.length - 1];
      const diff = ev.occurredAt.getTime() - lastEv.occurredAt.getTime();
      if (diff <= FIFTEEN_MINS_MS) {
        currentCluster.push(ev);
      } else {
        // Finalize cluster
        const earliest = new Date(currentCluster[0].occurredAt);
        let latest = new Date(currentCluster[currentCluster.length - 1].occurredAt);
        for (const cEv of currentCluster) {
          if (cEv.endedAt && new Date(cEv.endedAt) > latest) {
            latest = new Date(cEv.endedAt);
          }
        }
        clusters.push({
          startTime: new Date(earliest.getTime() - FIVE_MINS_MS),
          endTime: new Date(latest.getTime() + FIVE_MINS_MS),
          events: [...currentCluster],
        });
        currentCluster = [ev];
      }
    }
  }

  if (currentCluster.length > 0) {
    const earliest = new Date(currentCluster[0].occurredAt);
    let latest = new Date(currentCluster[currentCluster.length - 1].occurredAt);
    for (const cEv of currentCluster) {
      if (cEv.endedAt && new Date(cEv.endedAt) > latest) {
        latest = new Date(cEv.endedAt);
      }
    }
    clusters.push({
      startTime: new Date(earliest.getTime() - FIVE_MINS_MS),
      endTime: new Date(latest.getTime() + FIVE_MINS_MS),
      events: [...currentCluster],
    });
  }

  // 3b. Expand point-like clusters into meaningful work spans without crossing hard boundaries.
  // Commits/PRs usually mark end of work → expand mostly backward.
  // Issue activity (debug/investigation) expands both directions.
  const POINT_BACK_MS = 40 * 60 * 1000;
  const POINT_FWD_MS = 10 * 60 * 1000;
  const INVESTIGATION_PAD_MS = 20 * 60 * 1000;
  const MIN_POINT_SPAN_MS = 30 * 60 * 1000;
  const POINT_LIKE_MAX_MS = 25 * 60 * 1000;

  const expandPointClusters = (
    input: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }>
  ) => {
    const expanded = input.map((cl) => ({
      startTime: new Date(cl.startTime),
      endTime: new Date(cl.endTime),
      events: cl.events,
    }));

    for (let i = 0; i < expanded.length; i++) {
      const cl = expanded[i];
      const span = cl.endTime.getTime() - cl.startTime.getTime();
      const hasExplicitDuration = cl.events.some(
        (e) => e.endedAt != null || (typeof e.duration === 'number' && e.duration >= 15)
      );
      if (hasExplicitDuration || span > POINT_LIKE_MAX_MS) continue;

      const artifactTimes = cl.events.map((e) => e.occurredAt.getTime());
      const firstArtifact = Math.min(...artifactTimes);
      const lastArtifact = Math.max(...artifactTimes);

      let leftBound = Number.NEGATIVE_INFINITY;
      if (i > 0) leftBound = expanded[i - 1].endTime.getTime();
      for (const a of mergedCalendarAnchors) {
        if (a.endTime.getTime() <= cl.startTime.getTime()) {
          leftBound = Math.max(leftBound, a.endTime.getTime());
        }
      }
      // Soft floor: respect workday unless activity already sits outside it.
      const softLeft =
        firstArtifact < defaultWorkdayStart.getTime()
          ? firstArtifact - POINT_BACK_MS
          : defaultWorkdayStart.getTime();
      leftBound = Number.isFinite(leftBound) ? Math.max(leftBound, softLeft) : softLeft;

      let rightBound = Number.POSITIVE_INFINITY;
      if (i < expanded.length - 1) rightBound = expanded[i + 1].startTime.getTime();
      for (const a of mergedCalendarAnchors) {
        if (a.startTime.getTime() >= cl.endTime.getTime()) {
          rightBound = Math.min(rightBound, a.startTime.getTime());
        }
      }
      const softRight =
        lastArtifact > defaultWorkdayEnd.getTime()
          ? lastArtifact + POINT_FWD_MS
          : defaultWorkdayEnd.getTime();
      rightBound = Number.isFinite(rightBound) ? Math.min(rightBound, softRight) : softRight;

      if (rightBound <= leftBound) continue;

      const deliverableHeavy = cl.events.every((e) =>
        ['commit', 'pr_opened', 'pr_merged', 'pr_review'].includes(e.eventType)
      );

      let newStart: number;
      let newEnd: number;
      if (deliverableHeavy) {
        newEnd = Math.min(lastArtifact + POINT_FWD_MS, rightBound);
        newStart = Math.max(lastArtifact - POINT_BACK_MS, leftBound);
      } else {
        newStart = Math.max(firstArtifact - INVESTIGATION_PAD_MS, leftBound);
        newEnd = Math.min(lastArtifact + INVESTIGATION_PAD_MS, rightBound);
      }

      if (newEnd - newStart < MIN_POINT_SPAN_MS && rightBound - leftBound >= MIN_POINT_SPAN_MS) {
        const deficit = MIN_POINT_SPAN_MS - (newEnd - newStart);
        newStart = Math.max(leftBound, newStart - deficit);
        if (newEnd - newStart < MIN_POINT_SPAN_MS) {
          newEnd = Math.min(rightBound, newStart + MIN_POINT_SPAN_MS);
        }
      }

      if (newEnd > newStart) {
        cl.startTime = new Date(newStart);
        cl.endTime = new Date(newEnd);
      }
    }

    return expanded;
  };

  const durationAwareClusters = expandPointClusters(clusters);

  // 4. Adjust clusters so they do not overlap calendar anchors
  const adjustedNonCalendarSlots: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }> = [];

  for (const cl of durationAwareClusters) {
    let subStart = cl.startTime;
    let subEnd = cl.endTime;

    for (const anchor of mergedCalendarAnchors) {
      // If cluster completely inside anchor, skip non-calendar cluster representation
      if (subStart >= anchor.startTime && subEnd <= anchor.endTime) {
        subStart = subEnd;
        break;
      }
      // Overlaps start of anchor
      if (subStart < anchor.startTime && subEnd > anchor.startTime && subEnd <= anchor.endTime) {
        subEnd = anchor.startTime;
      }
      // Overlaps end of anchor
      if (subStart >= anchor.startTime && subStart < anchor.endTime && subEnd > anchor.endTime) {
        subStart = anchor.endTime;
      }
      // Anchor in middle of cluster -> split
      if (subStart < anchor.startTime && subEnd > anchor.endTime) {
        adjustedNonCalendarSlots.push({
          startTime: subStart,
          endTime: anchor.startTime,
          events: cl.events,
        });
        subStart = anchor.endTime;
      }
    }

    if (subEnd > subStart) {
      adjustedNonCalendarSlots.push({
        startTime: subStart,
        endTime: subEnd,
        events: cl.events,
      });
    }
  }

  // 5. Combine anchors and adjusted non-calendar slots into initial active segments
  interface IntermediateSegment {
    startTime: Date;
    endTime: Date;
    events: NormalizedEvent[];
    isCalendarAnchored: boolean;
  }

  const activeSegments: IntermediateSegment[] = [
    ...mergedCalendarAnchors.map((a) => ({ ...a, isCalendarAnchored: true })),
    ...adjustedNonCalendarSlots.map((n) => ({ ...n, isCalendarAnchored: false })),
  ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Merge adjacent/overlapping non-anchor segments
  const mergedActive: IntermediateSegment[] = [];
  for (const seg of activeSegments) {
    if (mergedActive.length === 0) {
      mergedActive.push(seg);
    } else {
      const prev = mergedActive[mergedActive.length - 1];
      if (
        !prev.isCalendarAnchored &&
        !seg.isCalendarAnchored &&
        seg.startTime.getTime() <= prev.endTime.getTime() + FIFTEEN_MINS_MS
      ) {
        prev.endTime = new Date(Math.max(prev.endTime.getTime(), seg.endTime.getTime()));
        prev.events = Array.from(new Set([...prev.events, ...seg.events]));
      } else {
        mergedActive.push(seg);
      }
    }
  }

  // 6. Determine overall timeline extent
  let timelineStart = defaultWorkdayStart;
  let timelineEnd = defaultWorkdayEnd;

  for (const seg of mergedActive) {
    if (seg.startTime < timelineStart) {
      timelineStart = seg.startTime;
    }
    if (seg.endTime > timelineEnd) {
      timelineEnd = seg.endTime;
    }
  }

  // 7. Fill timeline timelineStart -> timelineEnd with active segments & gap segments
  const result: TimeSegment[] = [];
  let currentTime = timelineStart;

  for (const seg of mergedActive) {
    if (seg.startTime > currentTime) {
      const gapMs = seg.startTime.getTime() - currentTime.getTime();
      const gapMins = Math.round(gapMs / 60000);

      if (gapMins > 15) {
        result.push({
          startTime: currentTime,
          endTime: seg.startTime,
          durationMinutes: gapMins,
          events: [],
          isCalendarAnchored: false,
          isGap: true,
        });
      } else if (gapMins > 0) {
        // Short gaps absorb into previous active work block when possible.
        const prev = result[result.length - 1];
        if (prev && !prev.isCalendarAnchored && !prev.isGap) {
          prev.endTime = seg.startTime;
          prev.durationMinutes = Math.max(
            1,
            Math.round((prev.endTime.getTime() - prev.startTime.getTime()) / 60000)
          );
        } else {
          // Otherwise pull the upcoming segment earlier.
          seg.startTime = currentTime;
        }
      }
    }

    const durationMinutes = Math.max(1, Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000));
    result.push({
      startTime: seg.startTime,
      endTime: seg.endTime,
      durationMinutes,
      events: seg.events,
      isCalendarAnchored: seg.isCalendarAnchored,
      isGap: false,
    });

    currentTime = seg.endTime > currentTime ? seg.endTime : currentTime;
  }

  if (currentTime < timelineEnd) {
    const gapMs = timelineEnd.getTime() - currentTime.getTime();
    const gapMins = Math.round(gapMs / 60000);
    if (gapMins > 0) {
      result.push({
        startTime: currentTime,
        endTime: timelineEnd,
        durationMinutes: gapMins,
        events: [],
        isCalendarAnchored: false,
        isGap: gapMins > 15,
      });
    }
  }

  return result;
}
