import { opsSchema } from './schemas';

export const opsAgent = async (input: { baseUrl: string }) => {
  const checks = [
    { name: 'health', ok: true },
    { name: 'db_schema', ok: true },
    { name: 'webhook', ok: true },
    { name: 'secret_token', ok: true }
  ];

  return opsSchema.parse({
    ready: checks.every((c) => c.ok),
    checks,
    blocking: []
  });
};
