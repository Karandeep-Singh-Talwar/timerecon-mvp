import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { reconstructWorkday } from '@/lib/allocation';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    let workSession = await prisma.workSession.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: targetDate,
        },
      },
      include: {
        allocations: {
          include: {
            workItem: true,
          },
        },
      },
    });

    if (!workSession) {
      workSession = await reconstructWorkday({
        userId: session.user.id,
        date,
      });
    }

    const categories: Record<string, number> = {
      jira_work: 0,
      meetings: 0,
      pr_reviews: 0,
      general_engineering: 0,
      admin: 0,
      unallocated: 0,
    };

    let itemsNeedingReviewCount = 0;

    for (const alloc of workSession?.allocations || []) {
      if (alloc.confidenceLevel === 'needs_review' || alloc.status !== 'approved') {
        itemsNeedingReviewCount++;
      }

      if (alloc.allocationType === 'work_item') {
        categories.jira_work += alloc.durationMinutes;
      } else if (alloc.allocationType === 'meeting') {
        categories.meetings += alloc.durationMinutes;
      } else if (alloc.allocationType === 'pr_review') {
        categories.pr_reviews += alloc.durationMinutes;
      } else if (alloc.allocationType === 'general_engineering') {
        categories.general_engineering += alloc.durationMinutes;
      } else if (alloc.allocationType === 'admin') {
        categories.admin += alloc.durationMinutes;
      } else {
        categories.unallocated += alloc.durationMinutes;
      }
    }

    return NextResponse.json({
      summary: {
        date,
        totalMinutes: workSession?.totalMinutes || 0,
        allocatedMinutes: workSession?.allocatedMinutes || 0,
        unallocatedMinutes: workSession?.unallocatedMinutes || 0,
        categories,
        itemsNeedingReviewCount,
        status: workSession?.status || 'draft',
        workSessionId: workSession?.id,
      },
    });
  } catch (error: any) {
    console.error('Error fetching review summary:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
