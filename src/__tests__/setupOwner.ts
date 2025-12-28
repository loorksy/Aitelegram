import { prisma } from '../core/prisma';
import { UserRole, UserStatus } from '@prisma/client';

async function setupOwner() {
  // Create or update owner user
  const owner = await prisma.user.upsert({
    where: { telegramId: 'owner-admin-001' },
    update: { role: UserRole.OWNER, status: UserStatus.APPROVED, credits: 10000 },
    create: {
      telegramId: 'owner-admin-001',
      name: 'System Owner',
      username: 'sysowner',
      role: UserRole.OWNER,
      status: UserStatus.APPROVED,
      credits: 10000,
      dailyCreditsLimit: 1000,
      approvedAt: new Date()
    }
  });
  
  // Create a test user (pending approval)
  const testUser = await prisma.user.upsert({
    where: { telegramId: 'test-user-002' },
    update: {},
    create: {
      telegramId: 'test-user-002',
      name: 'Test User',
      username: 'testuser2',
      role: UserRole.USER,
      status: UserStatus.PENDING_APPROVAL,
      credits: 0
    }
  });
  
  console.log('Owner created:', owner.id, owner.telegramId);
  console.log('Test user created:', testUser.id, testUser.telegramId);
  
  await prisma.$disconnect();
}

setupOwner().catch(console.error);
