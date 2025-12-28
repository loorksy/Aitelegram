import { opsAgent } from './opsAgent';

export const publishAgent = async (input: { baseUrl: string }) => {
  const ops = await opsAgent({ baseUrl: input.baseUrl });
  return {
    ready: ops.ready,
    checks: ops.checks,
    blocking: ops.blocking
  };
};
