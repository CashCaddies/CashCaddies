export const getTierFromContribution = (amount: number) => {
  if (amount >= 10000) return 5;
  if (amount >= 2000) return 4;
  if (amount >= 500) return 3;
  if (amount >= 100) return 2;
  return 1;
};
