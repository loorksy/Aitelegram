export const policyAgent = (description: string) => {
  const blockedTerms = ['hack', 'malware', 'phishing'];
  const lower = description.toLowerCase();
  const blocked = blockedTerms.some((term) => lower.includes(term));
  if (blocked) {
    return { allowed: false as const, reason: 'blocked_unsafe_request' as const };
  }
  return { allowed: true as const, reason: 'ok' as const };
};
