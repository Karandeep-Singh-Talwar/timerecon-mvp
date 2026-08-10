import bcrypt from 'bcryptjs';
import prisma from '../src/lib/db';
import { seedDogfoodData } from '../src/lib/dogfood/seed-dogfood';

async function main() {
  // Create test user
  const passwordHash = await bcrypt.hash('testpassword123', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'dev@timerecon.test' },
    update: {},
    create: {
      email: 'dev@timerecon.test',
      passwordHash,
      name: 'Test Developer',
      timezone: 'Asia/Kolkata',
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
    },
  });

  console.log('Created test user:', user.email);

  // Seed 5-day dogfood dataset
  console.log('Seeding 5-day dogfood dataset...');
  const result = await seedDogfoodData(user.id);
  console.log('Dogfood dataset seeded successfully:', result);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
