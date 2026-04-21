/**
 * Route group layout — auth and beta approval are enforced in `src/app/layout.tsx`.
 * This segment remains for URL organization only; do not rely on this file for security.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
