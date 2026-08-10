import prisma from '@/lib/db';

export interface TimesheetCSVRow {
  date: string;
  workItem: string;
  project: string;
  description: string;
  hours: string;
  billable: string;
}

/**
 * Creates or updates a Timesheet and TimesheetEntry records from an approved WorkSession.
 */
export async function generateTimesheet(workSessionId: string) {
  const workSession = await prisma.workSession.findUnique({
    where: { id: workSessionId },
    include: {
      allocations: {
        include: {
          workItem: true,
        },
      },
    },
  });

  if (!workSession) {
    throw new Error(`WorkSession not found: ${workSessionId}`);
  }

  // Update session status
  await prisma.workSession.update({
    where: { id: workSessionId },
    data: { status: 'approved' },
  });

  // Group allocations by workItem / project / category
  const entryMap = new Map<
    string,
    {
      workItemKey: string;
      project: string;
      description: string;
      durationMinutes: number;
      billable: boolean;
      category: string;
    }
  >();

  for (const alloc of workSession.allocations) {
    if (alloc.allocationType === 'unallocated') continue;

    const workItemKey = alloc.workItem?.externalId || alloc.workItemId || 'GENERAL';
    const project = alloc.workItem?.project || 'General';
    const category = alloc.allocationType;
    const key = `${workItemKey}_${project}_${category}_${alloc.title}`;

    if (entryMap.has(key)) {
      const existing = entryMap.get(key)!;
      existing.durationMinutes += alloc.durationMinutes;
    } else {
      entryMap.set(key, {
        workItemKey,
        project,
        description: alloc.title,
        durationMinutes: alloc.durationMinutes,
        billable: alloc.allocationType !== 'admin',
        category,
      });
    }
  }

  const entriesToCreate = Array.from(entryMap.values());

  // Upsert Timesheet
  const timesheet = await prisma.timesheet.upsert({
    where: { workSessionId },
    create: {
      workSessionId,
      userId: workSession.userId,
      date: workSession.date,
      totalMinutes: workSession.allocatedMinutes,
      status: 'approved',
      entries: {
        create: entriesToCreate,
      },
    },
    update: {
      totalMinutes: workSession.allocatedMinutes,
      status: 'approved',
      entries: {
        deleteMany: {},
        create: entriesToCreate,
      },
    },
    include: {
      entries: true,
    },
  });

  return timesheet;
}

/**
 * Converts a Timesheet into CSV string.
 */
export async function exportTimesheetCSV(timesheetId: string): Promise<string> {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: true,
    },
  });

  if (!timesheet) {
    throw new Error(`Timesheet not found: ${timesheetId}`);
  }

  const dateStr = timesheet.date.toISOString().split('T')[0];
  const headers = ['Date', 'Work Item', 'Project', 'Description', 'Hours', 'Billable'];

  const rows = timesheet.entries.map((entry) => {
    const hours = (entry.durationMinutes / 60).toFixed(2);
    const billable = entry.billable ? 'Yes' : 'No';
    const cleanDesc = `"${(entry.description || '').replace(/"/g, '""')}"`;
    const cleanWorkItem = `"${(entry.workItemKey || '').replace(/"/g, '""')}"`;
    const cleanProject = `"${(entry.project || '').replace(/"/g, '""')}"`;

    return [dateStr, cleanWorkItem, cleanProject, cleanDesc, hours, billable].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
