import { runAgentPipeline } from '../agents/agentOrchestrator';
import { prisma } from '../core/prisma';

async function testFullPipeline() {
  console.log('=== Testing Full Agent Pipeline with DB Storage ===\n');
  
  // Create test user first
  const user = await prisma.user.upsert({
    where: { telegramId: 'test-123456' },
    update: {},
    create: {
      telegramId: 'test-123456',
      name: 'Test User',
      username: 'testuser'
    }
  });
  console.log('User created:', user.id);
  
  const traceId = `trace-${Date.now()}`;
  const startTime = Date.now();
  
  const result = await runAgentPipeline({
    traceId,
    userId: user.id,
    chatId: 123456789,
    messageText: 'أريد إنشاء بوت متجر إلكتروني يعرض المنتجات ويستقبل الطلبات',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  
  const latencyMs = Date.now() - startTime;
  
  console.log('\n=== Pipeline Result ===');
  console.log(JSON.stringify(result, null, 2));
  
  // Store in AgentRun
  if (result.ok) {
    const agentRun = await prisma.agentRun.create({
      data: {
        traceId,
        userId: user.id,
        intent: result.intent,
        inputText: 'أريد إنشاء بوت متجر إلكتروني يعرض المنتجات ويستقبل الطلبات',
        planJson: result.plan,
        blueprintJson: result.blueprint,
        status: 'SUCCESS',
        latencyMs
      }
    });
    console.log('\n=== AgentRun Stored ===');
    console.log('ID:', agentRun.id);
    console.log('TraceId:', agentRun.traceId);
    console.log('Status:', agentRun.status);
    console.log('Latency:', agentRun.latencyMs, 'ms');
  }
  
  // Verify stored data
  const storedRun = await prisma.agentRun.findFirst({
    where: { traceId },
    include: { user: true }
  });
  
  console.log('\n=== Verified from DB ===');
  console.log('Found:', !!storedRun);
  if (storedRun) {
    console.log('Intent:', storedRun.intent);
    console.log('Plan steps:', (storedRun.planJson as any)?.steps?.length);
    console.log('Menu items:', (storedRun.blueprintJson as any)?.menu?.length);
  }
  
  await prisma.$disconnect();
}

testFullPipeline().catch(console.error);
