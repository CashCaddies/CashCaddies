export const isOwner = (email?: string | null) =>
  email === "cashcaddies@outlook.com";

export const isFounder = (profile?: any) =>
  !!profile?.is_founder;
