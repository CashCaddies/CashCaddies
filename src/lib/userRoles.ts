export const OWNER_EMAIL = "cashcaddies@outlook.com";

export const isOwner = (email?: string | null) =>
  email === OWNER_EMAIL;

export const isFounder = (email?: string | null) =>
  !!email; // all users are founders for now
