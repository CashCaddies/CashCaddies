import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <section className="space-y-4">
      <AuthForm mode="signup" />
      <p className="text-center text-sm text-slate-300">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-300 underline">
          Login
        </Link>
      </p>
    </section>
  );
}
