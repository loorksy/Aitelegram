import { z } from 'zod';
import { env } from '../config/env';

export interface Blueprint {
  name: string;
  description: string;
  menu: Array<{
    title: string;
    action: string;
  }>;
}

const blueprintSchema = z.object({
  name: z.string().min(3).max(60),
  description: z.string().min(5).max(200),
  menu: z.array(
    z.object({
      title: z.string().min(3).max(20),
      action: z.string().min(1).max(200)
    })
  ).min(3).max(7)
});

const fallbackBlueprint: Blueprint = {
  name: 'Smart Bot',
  description: 'Default bot blueprint',
  menu: [
    { title: 'الترحيب', action: 'مرحباً بك في البوت.' },
    { title: 'الخدمات', action: 'استعرض خدماتنا المتاحة.' },
    { title: 'الدعم', action: 'راسل الدعم للمساعدة.' }
  ]
};

export const generateBlueprint = async (
  botDescription: string
): Promise<Blueprint> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You generate bot blueprints in JSON only. Respond with a JSON object, menu-first structure.'
        },
        {
          role: 'user',
          content: `Create a menu-first blueprint for a Telegram bot. Description: ${botDescription}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4
    })
  });

  if (!response.ok) {
    return fallbackBlueprint;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return fallbackBlueprint;
  }

  try {
    const parsed = JSON.parse(content);
    const validated = blueprintSchema.parse(parsed);
    return validated;
  } catch {
    return fallbackBlueprint;
  }
};
