import { z } from 'zod';
import { callLLM } from '../ai/openaiClient';
import { logger } from '../utils/logger';
import { Blueprint } from './schemas';

const AdvisorSchema = z.object({
  suggestions: z.array(z.string().min(5)).min(1),
  critique: z.array(z.string().min(5)).default([]),
  improvedBlueprint: z.any().optional(), // Flexible for now
  summary: z.string()
});

export const advisorAgent = async (
  currentBlueprint: Blueprint,
  userRequest: string,
  context?: string
) => {
  const prompt = `
    You are an expert Telegram Bot Advisor.
    Analyze the current bot blueprint and the user's latest request.
    
    Current Blueprint: ${JSON.stringify(currentBlueprint)}
    User Request: "${userRequest}"
    Context: ${context || 'None'}
    
    Provide:
    1. Critical analysis of the current design (critique).
    2. Concrete suggestions for improvement (suggestions).
    3. A summary of your advice in Arabic.
    
    Focus on User Experience (UX) and completeness.
    Do NOT suggest technical changes (like server setup), only Bot Logic/Menu changes.
  `;

  return callLLM(prompt, AdvisorSchema);
};
