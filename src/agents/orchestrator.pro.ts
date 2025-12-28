import crypto from 'crypto';
import { prisma } from '../core/prisma';
import { plannerAgent } from './plannerAgent';
import { validatorAgent } from './validatorAgent';
import { previewAgent } from './previewAgent';
import { evaluatorAgent } from './evaluatorAgent';
import { abTestAgent } from './abTestAgent';
import { opsAgent } from './opsAgent';
import { retrieveKnowledge } from '../services/rag';
import { loadUserMemory } from './memoryAgent';
import { Blueprint } from './schemas';
import { policyAgent } from './policyAgent';

export type OrchestratorResult =
  | { traceId: string; runId: string; policy: { allowed: false; reason: 'blocked_unsafe_request' }; blocked: true }
  | {
      traceId: string;
      runId: string;
      policy: { allowed: true; reason: 'ok' };
      blocked: false;
      plan: ReturnType<typeof plannerAgent>;
      rag: { items: Array<Record<string, unknown>> };
      preview: ReturnType<typeof previewAgent>;
      ops: Awaited<ReturnType<typeof opsAgent>>;
      evaluation: ReturnType<typeof evaluatorAgent>;
      variants: {
        A: { blueprint: Blueprint; score: number };
        B: { blueprint: Blueprint; score: number };
        winner: 'A' | 'B';
      };
      blueprint: Blueprint;
    };

export const orchestrate = async (input: {
  userId: string;
  description: string;
  language: 'ar' | 'en';
}): Promise<OrchestratorResult> => {
  const traceId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  const memory = await loadUserMemory(input.userId);
  const rag = await retrieveKnowledge(input.description);

  const policy = policyAgent(input.description);
  if (!policy.allowed) {
    await prisma.agentRun.create({
      data: {
        traceId,
        userId: input.userId,
        intent: 'POLICY_BLOCKED',
        inputText: input.description.slice(0, 200),
        planJson: {},
        blueprintJson: {},
        status: 'FAILED',
        errorMessage: 'blocked_unsafe_request',
        latencyMs: 0
      }
    });
    return { traceId, runId, policy, blocked: true };
  }

  const plan = plannerAgent({
    description: input.description,
    language: input.language,
    context: memory?.preferences as Record<string, unknown> | undefined
  });

  const { variantA, variantB, scoreA, scoreB, winner } = abTestAgent(plan, input.language);

  const candidate = winner === 'A' ? variantA : variantB;
  const validated = validatorAgent(candidate);

  const evaluation = evaluatorAgent(validated.blueprint);
  const preview = previewAgent(validated.blueprint);

  const ops = await opsAgent({ baseUrl: 'https://api.lork.cloud' });

  await prisma.agentRun.create({
    data: {
      traceId,
      userId: input.userId,
      intent: plan.botPurpose.slice(0, 50),
      inputText: input.description.slice(0, 200),
      planJson: plan,
      blueprintJson: validated.blueprint,
      status: 'SUCCESS',
      latencyMs: 0
    }
  });

  return {
    traceId,
    runId,
    policy,
    blocked: false,
    plan,
    rag,
    preview,
    ops,
    evaluation,
    variants: {
      A: { blueprint: variantA, score: scoreA },
      B: { blueprint: variantB, score: scoreB },
      winner
    },
    blueprint: validated.blueprint as Blueprint
  };
};
