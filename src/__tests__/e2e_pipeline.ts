import { runAgentPipeline } from '../agents/agentOrchestrator';

async function run() {
  const result = await runAgentPipeline({
    traceId: `e2e-${Date.now()}`,
    userId: 'e2e-user-001',
    chatId: 123,
    messageText: 'بوت توصيل طعام',
    sessionState: 'AWAITING_DESCRIPTION'
  });
  console.log('=== PIPELINE RESULT ===');
  console.log('OK:', result.ok);
  if (result.ok) {
    console.log('Intent:', result.intent);
    console.log('Bot Name:', result.blueprint.name);
    console.log('Menu Items:', result.blueprint.menu.length);
    console.log('Credits Used:', result.creditsUsed);
  } else {
    console.log('Error:', result.errorMessage);
  }
}
run().catch(console.error);
