import { z, ZodSchema } from 'zod';
import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1'
});

export class LLMError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'LLMError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

type CallOptions = {
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
};

export type LLMResult<T> =
  | { ok: true; data: T; rawResponse?: string }
  | { ok: false; errorMessage: string; rawSnippet?: string };

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const shouldRetry = (status?: number) =>
  status === 429 || status === 502 || status === 503;

const buildRawSnippet = (raw: string) =>
  raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;

// Strict JSON extraction - no markdown, no prose
const extractJsonStrict = (raw: string): string => {
  // First try: assume it's already clean JSON
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  
  // Second try: extract from markdown code block
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const extracted = fencedMatch[1].trim();
    if (extracted.startsWith('{')) {
      return extracted;
    }
  }
  
  // Third try: find first complete JSON object
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return raw.slice(jsonStart, jsonEnd + 1);
  }
  
  return trimmed;
};

// Build strict system prompt for JSON-only output
const buildStrictSystemPrompt = (schemaDescription?: string): string => {
  let prompt = `You are a JSON-only API. Your entire response must be a single valid JSON object.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown. No code fences. No explanatory text.
- Start your response with { and end with }
- No extra keys beyond what is requested
- All string values must be properly escaped
- Use double quotes for keys and string values`;

  if (schemaDescription) {
    prompt += `\n\nExpected schema:\n${schemaDescription}`;
  }
  
  return prompt;
};

// Get model info for debugging
export const getModelInfo = () => ({
  model: 'gpt-4o-mini',
  baseURL: 'https://api.openai.com/v1',
  keyPrefix: env.OPENAI_API_KEY?.slice(0, 10) + '...'
});

// Debug LLM health check
export const debugLLMHealth = async (): Promise<{
  ok: boolean;
  model: string;
  baseURL: string;
  rawResponse?: string;
  error?: string;
  parsedData?: unknown;
}> => {
  const testSchema = z.object({
    intent: z.enum(['CREATE_BOT', 'EDIT_BOT', 'PUBLISH_BOT', 'HELP', 'UNKNOWN']),
    confidence: z.number().min(0).max(1)
  });
  
  const testPrompt = `Classify this user intent: "I want to create a customer support bot"

Return JSON with:
- intent: one of CREATE_BOT, EDIT_BOT, PUBLISH_BOT, HELP, UNKNOWN
- confidence: number between 0 and 1`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildStrictSystemPrompt() },
        { role: 'user', content: testPrompt }
      ]
    }, { timeout: 15000 });

    const rawContent = completion.choices?.[0]?.message?.content ?? '';
    const jsonStr = extractJsonStrict(rawContent);
    
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return {
        ok: false,
        model: 'gpt-4o-mini',
        baseURL: 'https://api.openai.com/v1',
        rawResponse: buildRawSnippet(rawContent),
        error: 'JSON parse failed'
      };
    }
    
    const validated = testSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        model: 'gpt-4o-mini',
        baseURL: 'https://api.openai.com/v1',
        rawResponse: buildRawSnippet(rawContent),
        error: `Zod validation failed: ${JSON.stringify(validated.error.issues)}`,
        parsedData: parsed
      };
    }
    
    return {
      ok: true,
      model: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      rawResponse: buildRawSnippet(rawContent),
      parsedData: validated.data
    };
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return {
      ok: false,
      model: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      error: apiError.message ?? 'Unknown error'
    };
  }
};

export const callLLM = async <T>(
  prompt: string,
  schema: ZodSchema<T>,
  opts?: CallOptions
): Promise<LLMResult<T>> => {
  const model = opts?.model ?? 'gpt-4o-mini';
  const temperature = opts?.temperature ?? 0.2;
  const timeoutMs = opts?.timeoutMs ?? 30000;
  const maxRetries = opts?.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();

    try {
      logger.info({ model, attempt, promptLength: prompt.length }, 'LLM request starting');
      
      const completion = await openai.chat.completions.create({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildStrictSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        timeout: timeoutMs
      });

      const rawContent = completion.choices?.[0]?.message?.content ?? '';
      const durationMs = Date.now() - startedAt;
      
      logger.info(
        { model, durationMs, rawContentLength: rawContent.length, rawSnippet: buildRawSnippet(rawContent) },
        'LLM raw response received'
      );

      if (!rawContent) {
        return { ok: false, errorMessage: 'LLM response missing content' };
      }

      const jsonStr = extractJsonStrict(rawContent);
      
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        logger.error(
          { 
            err: parseErr, 
            rawSnippet: buildRawSnippet(rawContent),
            extractedJson: buildRawSnippet(jsonStr)
          },
          'LLM returned non-JSON response'
        );
        return { 
          ok: false, 
          errorMessage: 'LLM returned non-JSON response',
          rawSnippet: buildRawSnippet(rawContent)
        };
      }

      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        logger.error(
          { 
            issues: validated.error.issues, 
            rawSnippet: buildRawSnippet(rawContent),
            parsedObject: JSON.stringify(parsed).slice(0, 500)
          },
          'LLM response schema validation failed'
        );
        return { 
          ok: false, 
          errorMessage: `Schema validation failed: ${validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          rawSnippet: buildRawSnippet(rawContent)
        };
      }
      
      logger.info({ durationMs }, 'LLM response validated successfully');
      return { ok: true, data: validated.data, rawResponse: buildRawSnippet(rawContent) };
      
    } catch (error) {
      const apiError = error as { status?: number; code?: string; message?: string };
      
      logger.error(
        { err: error, attempt, status: apiError.status, code: apiError.code },
        'LLM API error'
      );
      
      if (shouldRetry(apiError.status) && attempt < maxRetries) {
        const delay = 500 * (attempt + 1);
        logger.warn({ attempt, status: apiError.status, delay }, 'LLM transient error, retrying');
        await sleep(delay);
        continue;
      }

      if (apiError.code === 'ETIMEDOUT' || apiError.code === 'ECONNABORTED') {
        if (attempt < maxRetries) {
          const delay = 500 * (attempt + 1);
          logger.warn({ attempt, delay }, 'LLM request timeout, retrying');
          await sleep(delay);
          continue;
        }
        return { ok: false, errorMessage: 'LLM request timed out' };
      }

      if (error instanceof z.ZodError) {
        return { ok: false, errorMessage: 'LLM response schema validation failed' };
      }

      if (error instanceof LLMError) {
        return { ok: false, errorMessage: error.message };
      }

      return { ok: false, errorMessage: apiError.message ?? 'Unexpected LLM error' };
    }
  }

  return { ok: false, errorMessage: 'LLM request exceeded retry attempts' };
};
