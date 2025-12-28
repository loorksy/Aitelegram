import { runAgentPipeline } from '../agents/agentOrchestrator';
import { prisma } from '../core/prisma';
import { UserStatus } from '@prisma/client';

async function testInsufficientCredits() {
  // Create user with low credits
  const user = await prisma.user.upsert({
    where: { telegramId: 'low-credit-user' },
    update: { credits: 5, status: UserStatus.APPROVED },
    create: {
      telegramId: 'low-credit-user',
      name: 'Low Credit User',
      status: UserStatus.APPROVED,
      credits: 5, // Less than PIPELINE_COST (10)
      approvedAt: new Date()
    }
  });
  
  console.log('Testing with low credit user:', user.id, 'credits:', user.credits);
  
  const result = await runAgentPipeline({
    traceId: `low-credit-${Date.now()}`,
    userId: user.id,
    chatId: 123,
    messageText: 'أريد إنشاء بوت',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  await prisma.$disconnect();
}

testInsufficientCredits().catch(console.error);
