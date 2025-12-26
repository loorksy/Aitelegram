import { env } from '../config/env';

export const checkModeration = async (text: string) => {
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: text
    })
  });

  if (!response.ok) {
    return { flagged: false };
  }

  const data = await response.json();
  const result = data.results?.[0];

  return {
    flagged: Boolean(result?.flagged),
    categories: result?.categories ?? {}
  };
};
