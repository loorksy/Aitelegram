import { blueprintSchema, validationReportSchema, Blueprint, ValidationReport } from './schemas';

export const validatorAgent = (blueprint: Blueprint) => {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const item of blueprint.menu) {
    if (ids.has(item.id)) {
      issues.push('duplicate_menu_id');
    }
    ids.add(item.id);
    if (!item.action) {
      issues.push('missing_action');
    }
  }

  if (!blueprint.fallback?.message) {
    issues.push('missing_fallback');
  }

  const ok = issues.length === 0;
  const report: ValidationReport = {
    ok,
    issues,
    repaired: false
  };

  validationReportSchema.parse(report);

  if (ok) {
    return { blueprint, report };
  }

  const repaired = {
    ...blueprint,
    fallback: blueprint.fallback ?? { id: 'fallback', message: 'Fallback' }
  };

  return {
    blueprint: blueprintSchema.parse(repaired),
    report: validationReportSchema.parse({ ...report, repaired: true })
  };
};
