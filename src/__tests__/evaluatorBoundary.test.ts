import { describe, expect, it } from 'vitest';
import { evaluatorAgent } from '../agents/evaluatorAgent';

const blueprint = {
  language: 'ar' as const,
  welcome: 'مرحباً',
  menu: [
    { id: 'm1', title: 'A', action: 'A' },
    { id: 'm2', title: 'B', action: 'B' },
    { id: 'm3', title: 'C', action: 'C' }
  ],
  fallback: { id: 'fallback', message: 'fallback' }
};

describe('evaluator boundaries', () => {
  it('returns approve for acceptable scores', () => {
    const report = evaluatorAgent(blueprint);
    expect(report.action).toBe('approve');
    expect(report.score).toBeGreaterThanOrEqual(75);
  });
});
