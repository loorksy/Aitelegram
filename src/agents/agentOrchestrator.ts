import { z } from 'zod';
import { callLLM } from '../ai/openaiClient';
import { logger } from '../utils/logger';
import { SessionState, AgentRunStatus } from '@prisma/client';
import { prisma } from '../core/prisma';
import { checkUserCredits, deductCredits, PIPELINE_COST } from '../services/credits.service';
import { advisorAgent } from './advisorAgent';

export type AgentPipelineInput = {
  traceId: string;
  userId: string;
  chatId: number;
  messageText: string;
  sessionId?: string;
  sessionState?: SessionState | null;
  currentBot?: { id: string; name?: string | null; description?: string | null } | null;
  draftFlow?: { blueprint: unknown } | null;
  skipCreditCheck?: boolean; // For testing purposes
};

export type AgentPipelineOutput =
  | {
    ok: true;
    intent: string;
    plan: { steps: string[]; assumptions: string[] };
    blueprint: Blueprint;
    summary: string;
    confidence: number;
    validatorErrors?: string[];
    creditsUsed?: number;
  }
  | { ok: false; errorMessage: string; summary: string; blockedReason?: string };

type Blueprint = {
  name: string;
  description: string;
  menu: Array<{ title: string; action: string }>;
  skills?: string[];
  triggers?: Array<{ type: string; action: string }>;
  config?: Record<string, unknown>;
};

const IntentSchema = z.object({
  intent: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    z.enum(['CREATE_BOT', 'EDIT_BOT', 'PUBLISH_BOT', 'HELP', 'CONSULTATION', 'UNKNOWN'])
  ),
  confidence: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().min(0).max(1)
  )
});

const PlanSchema = z.object({
  steps: z.array(z.string().min(1).transform((value) => value.trim())).min(1),
  assumptions: z.array(z.string().min(1).transform((value) => value.trim())).default([])
});

const BlueprintSchema = z.object({
  name: z.string().min(3).max(60).transform((value) => value.trim()),
  description: z.string().min(5).max(200).transform((value) => value.trim()),
  menu: z
    .array(
      z.object({
        title: z.string().min(1).max(20).transform((value) => value.trim()),
        action: z.string().min(1).max(200).transform((value) => value.trim())
      })
    )
    .min(3)
    .min(3)
    .max(7),
  skills: z.array(z.string()).default([]),
  triggers: z.array(z.object({
    type: z.enum(['message', 'photo', 'video', 'document', 'voice', 'new_chat_member', 'left_chat_member']),
    action: z.string()
  })).default([]),
  config: z.record(z.unknown()).default({})
});

const BuilderSchema = z.object({
  summary: z.string().min(5).max(200).transform((value) => value.trim()),
  confidence: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().min(0).max(1)
  ),
  blueprint: BlueprintSchema
});

const logStage = async <T>(
  input: AgentPipelineInput,
  stageName: string,
  fn: () => Promise<T>
) => {
  logger.info(
    { traceId: input.traceId, stageName, userId: input.userId, botId: input.currentBot?.id },
    'Agent stage started'
  );
  const startedAt = Date.now();
  const result = await fn();
  logger.info(
    {
      traceId: input.traceId,
      stageName,
      durationMs: Date.now() - startedAt,
      userId: input.userId,
      botId: input.currentBot?.id
    },
    'Agent stage completed'
  );
  return result;
};

const buildContextSnippet = (input: AgentPipelineInput) => {
  const context: Record<string, unknown> = {
    sessionState: input.sessionState ?? null,
    currentBot: input.currentBot ?? null
  };
  if (input.draftFlow?.blueprint) {
    context.lastBlueprint = input.draftFlow.blueprint;
  }
  return JSON.stringify(context);
};

const validateBlueprint = (blueprint: Blueprint) => {
  const errors: string[] = [];
  if (!blueprint.name || blueprint.name.trim().length < 3) {
    errors.push('اسم البوت قصير جداً.');
  }
  if (!blueprint.description || blueprint.description.trim().length < 5) {
    errors.push('وصف البوت قصير جداً.');
  }
  if (blueprint.menu.length < 3 || blueprint.menu.length > 7) {
    errors.push('عدد عناصر القائمة يجب أن يكون بين 3 و7.');
  }
  blueprint.menu.forEach((item, index) => {
    if (!item.title || item.title.trim().length === 0) {
      errors.push(`عنصر القائمة رقم ${index + 1} بدون عنوان.`);
    }
    if (!item.action || item.action.trim().length === 0) {
      errors.push(`عنصر القائمة رقم ${index + 1} بدون إجراء.`);
    }
  });
  return errors;
};

export const runAgentPipeline = async (
  input: AgentPipelineInput
): Promise<AgentPipelineOutput> => {
  const fallbackSummary = 'صار خطأ مؤقت في المعالجة. حاول مرة أخرى.';
  const startTime = Date.now();

  // Check credits and approval status (unless skipped for testing)
  if (!input.skipCreditCheck) {
    const creditCheck = await checkUserCredits(input.userId);

    if (!creditCheck.allowed) {
      logger.warn(
        { traceId: input.traceId, userId: input.userId, reason: creditCheck.reason },
        'Pipeline blocked - credit/approval check failed'
      );

      // Store blocked run in DB
      await prisma.agentRun.create({
        data: {
          traceId: input.traceId,
          userId: input.userId,
          intent: 'BLOCKED',
          inputText: input.messageText.slice(0, 200),
          planJson: {},
          blueprintJson: {},
          status: 'FAILED',
          errorMessage: creditCheck.reason,
          latencyMs: Date.now() - startTime
        }
      });

      const userMessages: Record<string, string> = {
        'user_not_found': 'المستخدم غير موجود.',
        'user_status_pending_approval': 'حسابك في انتظار موافقة المشرف. يرجى الانتظار.',
        'user_status_denied': 'تم رفض حسابك. تواصل مع المشرف.',
        'user_status_suspended': 'تم إيقاف حسابك مؤقتاً.',
        'daily_limit_exceeded': `وصلت للحد اليومي (${creditCheck.dailyUsed}/${creditCheck.dailyLimit}). حاول غداً.`,
        'insufficient_credits': `رصيدك غير كافٍ (${creditCheck.currentBalance} < ${PIPELINE_COST}). اشحن رصيدك.`
      };

      return {
        ok: false,
        errorMessage: creditCheck.reason ?? 'blocked',
        summary: userMessages[creditCheck.reason ?? ''] ?? 'لا يمكن تنفيذ الطلب حالياً.',
        blockedReason: creditCheck.reason
      };
    }
  }

  const context = buildContextSnippet(input);

  // Fetch conversation history
  const history = input.sessionId ? await prisma.chatMessage.findMany({
    where: { sessionId: input.sessionId },
    orderBy: { createdAt: 'desc' },
    take: 6
  }) : [];
  const historyText = history.reverse().map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  const intentResult = await logStage(input, 'IntentDetection', async () => {
    const prompt = `Classify the user intent.

User message: "${input.messageText}"
Session state: ${input.sessionState ?? 'NONE'}
History:
${historyText}

Return ONLY this JSON structure (no extra keys):
{
  "intent": "CREATE_BOT" | "EDIT_BOT" | "PUBLISH_BOT" | "HELP" | "UNKNOWN",
  "confidence": <number between 0 and 1>
}

Choose intent based on:
- CREATE_BOT: user wants to create/build a new bot
- EDIT_BOT: user wants to modify existing bot
- PUBLISH_BOT: user wants to publish/deploy bot
- HELP: user asks for help/instructions
- CONSULTATION: user wants to discuss, ask advice, or refine ideas WITHOUT building yet
- UNKNOWN: cannot determine intent`;
    return callLLM(prompt, IntentSchema);
  });

  if (!intentResult.ok) {
    logger.warn({ traceId: input.traceId, error: intentResult.errorMessage }, 'IntentDetection failed');
    return { ok: false, errorMessage: intentResult.errorMessage, summary: fallbackSummary };
  }

  if (intentResult.data.intent === 'CONSULTATION') {
    const currentBlueprint = (input.draftFlow?.blueprint as Blueprint) || {
      name: 'New Bot',
      description: input.currentBot?.description || '',
      menu: []
    };

    const advisorResult = await logStage(input, 'Advisor', async () => {
      // Pass meaningful context
      const context = `Session: ${input.sessionState}\nHistory:\n${historyText}`;
      return advisorAgent(currentBlueprint, input.messageText, context);
    });

    if (!advisorResult.ok) {
      return { ok: false, errorMessage: advisorResult.errorMessage, summary: fallbackSummary };
    }

    return {
      ok: true,
      intent: 'CONSULTATION',
      plan: { steps: [], assumptions: [] },
      blueprint: currentBlueprint,
      summary: advisorResult.data.summary + '\n\n💡 اقتراحات:\n' + advisorResult.data.suggestions.map((s: string) => `• ${s}`).join('\n'),
      confidence: 0.9,
      creditsUsed: 0
    };
  }

  const planResult = await logStage(input, 'Planner', async () => {
    const prompt = `Create a plan for building a Telegram bot.

Intent: ${intentResult.data.intent}
User request: "${input.messageText}"

Return ONLY this JSON structure (no extra keys):
{
  "steps": ["step1", "step2", "step3", ...],
  "assumptions": ["assumption1", "assumption2", ...]
}

Requirements:
- steps: array of 3-6 action steps (strings, min 3 chars each)
- assumptions: array of assumptions made (can be empty array)`;
    return callLLM(prompt, PlanSchema);
  });

  if (!planResult.ok) {
    logger.warn({ traceId: input.traceId, error: planResult.errorMessage }, 'Planner failed');
    return { ok: false, errorMessage: planResult.errorMessage, summary: fallbackSummary };
  }

  const builderResult = await logStage(input, 'Builder', async () => {
    // RAG: Fetch similar examples
    const { LearningService } = await import('../services/learningService');
    const examples = await LearningService.findSimilarExamples(input.messageText);
    const examplesText = examples.length > 0
      ? `\nExamples of successful bots (use as inspiration):\n${examples.map(e => `- Name: ${e.name}, Desc: ${e.description}, Skills: ${e.skills.join(', ')}`).join('\n')}\n`
      : '';

    const prompt = `Create a Telegram bot blueprint based on user request.
${examplesText}

User request: "${input.messageText}"
Intent: ${intentResult.data.intent}
Plan: ${JSON.stringify(planResult.data)}

Return ONLY this JSON structure:
{
  "blueprint": {
    "name": "<bot name, 3-60 chars>",
    "description": "<bot description, 5-200 chars>",
    "menu": [
      {"title": "<button title, 1-20 chars>", "action": "<response text, 1-200 chars>"},
      ... (3-7 menu items required)
      ... (3-7 menu items required)
    ],
    "skills": ["optional_skill1", "optional_skill2"],
    "triggers": [],
    "config": {}
  },
  "summary": "<Arabic summary of what was created, 5-200 chars>",
  "confidence": <number between 0 and 1>
}

Requirements:
- name: bot name (3-60 characters)
- description: bot purpose (5-200 characters)
- menu: array of 3-7 items, each with title and action
- skills: array of required skills (e.g. ['media_downloader', 'group_admin', 'ai_chat'])
- triggers: array of event triggers
- summary: Arabic text describing the bot
- confidence: number 0-1`;
    return callLLM(prompt, BuilderSchema);
  });

  if (!builderResult.ok) {
    logger.warn({ traceId: input.traceId, error: builderResult.errorMessage }, 'Builder failed');
    return { ok: false, errorMessage: builderResult.errorMessage, summary: fallbackSummary };
  }

  const validatorErrors = await logStage(input, 'Validator', async () => {
    const errors = validateBlueprint(builderResult.data.blueprint as Blueprint);
    return errors;
  });

  let finalBlueprint: Blueprint = builderResult.data.blueprint as Blueprint;
  let finalSummary: string = String(builderResult.data.summary);
  let finalConfidence: number = Number(builderResult.data.confidence);

  if (validatorErrors.length > 0) {
    const repairResult = await logStage(input, 'Repair', async () => {
      const prompt = [
        'Repair the blueprint JSON to satisfy the validation errors.',
        `Errors: ${JSON.stringify(validatorErrors)}`,
        `Current blueprint: ${JSON.stringify(builderResult.data.blueprint)}`,
        `Context: ${buildContextSnippet(input)}`,
        'Return JSON with blueprint, summary (Arabic), confidence (0-1).'
      ].join('\n');
      return callLLM(prompt, BuilderSchema);
    });

    if (!repairResult.ok) {
      logger.warn({ traceId: input.traceId, error: repairResult.errorMessage }, 'Repair failed');
      return { ok: false, errorMessage: repairResult.errorMessage, summary: fallbackSummary };
    }

    const repairedErrors = validateBlueprint(repairResult.data.blueprint as Blueprint);
    if (repairedErrors.length > 0) {
      return { ok: false, errorMessage: 'Validator failed after repair', summary: fallbackSummary };
    }

    finalBlueprint = repairResult.data.blueprint as Blueprint;
    finalSummary = String(repairResult.data.summary);
    finalConfidence = Number(repairResult.data.confidence);
    finalConfidence = Number(repairResult.data.confidence);
  }

  // Check for missing secrets if we have a bot context
  if (input.currentBot?.id && finalBlueprint.skills) {
    const missingKeys = await checkMissingSecrets(input.currentBot.id, finalBlueprint.skills);
    if (missingKeys.length > 0) {
      finalSummary += `\n\n⚠️ تنبيه: هذا البوت يحتاج مفاتيح API ليعمل: ${missingKeys.join(', ')}. يرجى إضافتها في الإعدادات.`;
    }
  } else if (!input.currentBot?.id && finalBlueprint.skills) {
    // New bot scenario - just warn generically
    const allRequired = new Set<string>();
    finalBlueprint.skills.forEach(s => (REQUIRED_SECRETS[s] || []).forEach(k => allRequired.add(k)));
    if (allRequired.size > 0) {
      finalSummary += `\n\n⚠️ ملاحظة: بعد إنشاء البوت، ستحتاج لإضافة المفاتيح التالية: ${Array.from(allRequired).join(', ')}.`;
    }
  }

  // Deduct credits after successful pipeline (unless skipped)
  let creditsUsed = 0;
  if (!input.skipCreditCheck) {
    const deductResult = await deductCredits(
      input.userId,
      PIPELINE_COST,
      'pipeline_run',
      input.traceId
    );
    if (deductResult.success) {
      creditsUsed = PIPELINE_COST;
    }
  }

  return {
    ok: true,
    intent: String(intentResult.data.intent),
    plan: {
      steps: planResult.data.steps,
      assumptions: planResult.data.assumptions ?? []
    },
    blueprint: finalBlueprint,
    summary: finalSummary,
    confidence: finalConfidence,
    validatorErrors: validatorErrors.length > 0 ? validatorErrors : undefined,
    creditsUsed
  };
};

const REQUIRED_SECRETS: Record<string, string[]> = {
  'ai_chat': ['OPENAI_API_KEY'],
  'image_generator': ['OPENAI_API_KEY'],
  'voice_transcriber': ['OPENAI_API_KEY'],
};

async function checkMissingSecrets(botId: string | undefined, skills: string[] = []): Promise<string[]> {
  if (!botId) return []; // Cannot check if bot doesn't exist yet

  // Dynamic import to avoid circular dep if any (though SecretService should be fine)
  const { SecretService } = await import('../services/secretService'); // Lazy import just in case

  const missing: Set<string> = new Set();

  for (const skill of skills) {
    const keys = REQUIRED_SECRETS[skill] || [];
    for (const key of keys) {
      const stored = await SecretService.getSecret(botId, key);
      if (!stored) missing.add(key);
    }
  }

  return Array.from(missing);
}
