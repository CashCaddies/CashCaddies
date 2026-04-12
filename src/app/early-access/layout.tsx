export const dynamic = "force-dynamic";

export default function EarlyAccessLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
