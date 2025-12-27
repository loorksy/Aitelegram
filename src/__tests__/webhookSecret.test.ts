import { describe, expect, it } from 'vitest';
const createRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: unknown) => payload;
  return res;
};

describe('webhook secret guard', () => {
  it('rejects when secret mismatch', () => {
    process.env.WEBHOOK_SECRET = 'secret';
    return import('../middleware/webhookSecret').then(({ webhookSecretGuard }) => {
    const req: any = { headers: { 'x-telegram-bot-api-secret-token': 'bad' } };
    const res = createRes();
    let called = false;
    webhookSecretGuard(req, res, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    });
  });

  it('accepts when secret matches', () => {
    process.env.WEBHOOK_SECRET = 'secret';
    return import('../middleware/webhookSecret').then(({ webhookSecretGuard }) => {
    const req: any = { headers: { 'x-telegram-bot-api-secret-token': 'secret' } };
    const res = createRes();
    let called = false;
    webhookSecretGuard(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    });
  });
});
