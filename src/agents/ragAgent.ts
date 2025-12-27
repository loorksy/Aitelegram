import { retrieveKnowledge } from '../services/rag';

export const ragAgent = async (query: string) => {
  return retrieveKnowledge(query);
};
