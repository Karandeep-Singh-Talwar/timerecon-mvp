import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { exportTimesheetCSV } from '@/lib/export';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const timesheet = await prisma.timesheet.findUnique({
      where: { id },
    });

    if (!timesheet || timesheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    }

    const csvContent = await exportTimesheetCSV(id);
    const dateStr = timesheet.date.toISOString().split('T')[0];

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="timesheet-${dateStr}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting timesheet CSV:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
