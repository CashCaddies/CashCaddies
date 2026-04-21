import { requireUser } from "@/lib/auth/require-user";
import PageClient from "./page-client";

export default async function Page() {
  await requireUser();
  return <PageClient />;
}
