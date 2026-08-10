import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { seedDogfoodData } from '@/lib/dogfood/seed-dogfood';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
      const testUser = await prisma.user.findUnique({
        where: { email: 'dev@timerecon.test' },
      });
      if (testUser) {
        userId = testUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized and test user dev@timerecon.test not found' },
        { status: 401 }
      );
    }

    const result = await seedDogfoodData(userId);

    return NextResponse.json({
      message: '5-day dogfood demo dataset seeded successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error seeding demo data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
