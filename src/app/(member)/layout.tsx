import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { UserMenu } from "@/components/shell/user-menu";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const displayName = session.user.name ?? session.user.email ?? "会员";

  return (
    <AppShell
      variant="member"
      userMenu={<UserMenu name={displayName} role={session.user.role} />}
    >
      {children}
    </AppShell>
  );
}
