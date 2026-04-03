export type BetaFeedbackAdminRow = {
  id: string;
  user_id: string;
  username: string | null;
  email: string | null;
  feedback_type: string | null;
  title: string | null;
  message: string | null;
  issue_page: string | null;
  status: string;
  created_at: string;
};

export const ADMIN_FEEDBACK_STATUSES = ["new", "reviewed", "planned", "fixed"] as const;
export type AdminFeedbackStatus = (typeof ADMIN_FEEDBACK_STATUSES)[number];
