import { runAgentPipeline } from '../agents/agentOrchestrator';

async function testPipeline() {
  console.log('Testing Agent Pipeline...\n');
  
  const result = await runAgentPipeline({
    traceId: 'test-trace-001',
    userId: 'test-user-001',
    chatId: 123456789,
    messageText: 'أريد بوت لخدمة العملاء يجيب على الأسئلة الشائعة ويتواصل مع الدعم الفني',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
}

testPipeline().catch(console.error);
