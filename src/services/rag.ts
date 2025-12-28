import { prisma } from '../core/prisma';

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const retrieveKnowledge = async (query: string) => {
  const tokens = tokenize(query).slice(0, 5);
  if (tokens.length === 0) {
    return { items: [] };
  }

  const items = await prisma.knowledgeBaseItem.findMany({
    where: {
      OR: [
        { title: { contains: tokens[0], mode: 'insensitive' } },
        { content: { contains: tokens[0], mode: 'insensitive' } },
        { tags: { hasSome: tokens } }
      ]
    },
    take: 5
  });

  return {
    items: items.map((item: { id: string; type: string; title: string; content: string; tags: string[]; language: string }) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      excerpt: item.content.slice(0, 120),
      tags: item.tags,
      language: item.language
    }))
  };
};
