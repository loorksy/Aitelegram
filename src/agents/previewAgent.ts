import { Blueprint, previewSchema } from './schemas';

export const previewAgent = (blueprint: Blueprint) => {
  const menuLines = blueprint.menu.map((item) => `• ${item.title} → ${item.action}`);
  const message = [
    blueprint.welcome,
    'القائمة:',
    ...menuLines
  ].join('\n');

  const warnings: string[] = [];
  if (blueprint.menu.length < 3) {
    warnings.push('قائمة قصيرة جداً');
  }

  return previewSchema.parse({ message, warnings });
};
