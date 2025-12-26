import { planSchema, Plan } from './schemas';

export const plannerAgent = (input: {
  description: string;
  language: 'ar' | 'en';
  context?: Record<string, unknown>;
}) => {
  const fallbackMenus = input.language === 'ar'
    ? ['الرئيسية', 'الخدمات', 'الدعم']
    : ['Home', 'Services', 'Support'];

  const plan: Plan = {
    botPurpose: input.description.slice(0, 80),
    targetAudience: input.context?.['targetAudience'] as string ?? (input.language === 'ar' ? 'عملاء عامون' : 'General users'),
    mainMenus: fallbackMenus,
    actionsNeeded: ['answer_questions', 'show_menu'],
    dataNeeds: []
  };

  return planSchema.parse(plan);
};
