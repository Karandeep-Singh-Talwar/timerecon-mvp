import prisma from '@/lib/db';
import { NormalizedEvent } from '@prisma/client';

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

function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function timeZoneOffsetMilliseconds(timestamp: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  const renderedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return renderedAsUtc - timestamp.getTime();
}

function zonedDateTime(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const firstPass = new Date(utcGuess - timeZoneOffsetMilliseconds(new Date(utcGuess), timezone));
  const secondOffset = timeZoneOffsetMilliseconds(firstPass, timezone);
  return new Date(utcGuess - secondOffset);
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
      events: currentCluster,
    });
  }

  // 4. Adjust clusters so they do not overlap calendar anchors
  const adjustedNonCalendarSlots: Array<{ startTime: Date; endTime: Date; events: NormalizedEvent[] }> = [];

  for (const cl of clusters) {
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
        // Extend non-calendar segment or insert short gap
        result.push({
          startTime: currentTime,
          endTime: seg.startTime,
          durationMinutes: gapMins,
          events: [],
          isCalendarAnchored: false,
          isGap: true,
        });
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
