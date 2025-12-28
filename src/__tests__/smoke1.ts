import { runAgentPipeline } from '../agents/agentOrchestrator';

async function test() {
  const result = await runAgentPipeline({
    traceId: 'smoke-1',
    userId: 'test-user',
    chatId: 123,
    messageText: 'بوت مطعم لعرض القائمة',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  console.log('Test 1 - Short prompt:', result.ok ? 'PASS' : 'FAIL');
  if (result.ok) {
    console.log('Menu items:', result.blueprint.menu.length, '(should be 3-7)');
  } else {
    console.log('Error:', result.errorMessage);
  }
}
test();
