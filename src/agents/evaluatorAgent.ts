import { evaluatorSchema, Blueprint, EvaluatorReport } from './schemas';

export const evaluatorAgent = (blueprint: Blueprint) => {
  const baseScore = 80;
  const score = Math.min(100, baseScore + (blueprint.menu.length >= 4 ? 5 : 0));
  const report: EvaluatorReport = {
    score,
    breakdown: {
      clarity: 80,
      completeness: 80,
      safety: 90,
      ux: 75,
      i18n: 80
    },
    reasons: score < 75 ? ['low_score'] : ['ok'],
    action: score >= 75 ? 'approve' : 'regenerate'
  };

  return evaluatorSchema.parse(report);
};
