import { runAgentPipeline } from '../agents/agentOrchestrator';
import { prisma } from '../core/prisma';

async function testCreditBlock() {
  // Get the pending user
  const pendingUser = await prisma.user.findUnique({
    where: { telegramId: 'test-123456' }
  });
  
  if (!pendingUser) {
    console.log('Pending user not found');
    return;
  }
  
  console.log('Testing with pending user:', pendingUser.id, 'status:', pendingUser.status);
  
  // Try to run pipeline
  const result = await runAgentPipeline({
    traceId: `block-test-${Date.now()}`,
    userId: pendingUser.id,
    chatId: 123,
    messageText: 'أريد إنشاء بوت',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  // Check if blocked AgentRun was stored
  const blockedRun = await prisma.agentRun.findFirst({
    where: { userId: pendingUser.id, intent: 'BLOCKED' }
  });
  
  if (blockedRun) {
    console.log('\nBlocked run stored:', blockedRun.id, 'error:', blockedRun.errorMessage);
  }
  
  await prisma.$disconnect();
}

testCreditBlock().catch(console.error);
