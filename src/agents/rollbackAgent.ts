export const rollbackAgent = (reason: string) => {
  return {
    status: 'rolled_back',
    reason
  };
};
