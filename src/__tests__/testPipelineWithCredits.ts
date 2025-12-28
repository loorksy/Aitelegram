import { runAgentPipeline } from '../agents/agentOrchestrator';
import { prisma } from '../core/prisma';

async function testPipelineWithCredits() {
  // Use the approved test user
  const user = await prisma.user.findUnique({
    where: { telegramId: 'test-user-002' }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('Before pipeline - Credits:', user.credits);
  
  const result = await runAgentPipeline({
    traceId: `credit-test-${Date.now()}`,
    userId: user.id,
    chatId: 123,
    messageText: 'بوت لحجز مواعيد صالون',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  
  console.log('\nPipeline result:', result.ok ? 'SUCCESS' : 'FAILED');
  if (result.ok) {
    console.log('Credits used:', result.creditsUsed);
    console.log('Bot name:', result.blueprint.name);
  }
  
  // Check updated credits
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id }
  });
  console.log('After pipeline - Credits:', updatedUser?.credits);
  
  await prisma.$disconnect();
}

testPipelineWithCredits().catch(console.error);
