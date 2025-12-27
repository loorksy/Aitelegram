import { Blueprint, blueprintSchema } from './schemas';

export const editWizardAgent = (blueprint: Blueprint, input: {
  type: 'rename' | 'action';
  menuId: string;
  value: string;
}) => {
  const updated = {
    ...blueprint,
    menu: blueprint.menu.map((item) => {
      if (item.id !== input.menuId) {
        return item;
      }
      if (input.type === 'rename') {
        return { ...item, title: input.value };
      }
      return { ...item, action: input.value };
    })
  };

  return blueprintSchema.parse(updated);
};
