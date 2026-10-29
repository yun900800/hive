import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { UserMenu } from "@/components/shell/user-menu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const displayName = session.user.name ?? session.user.email ?? "管理员";

  return (
    <AppShell
      variant="admin"
      userMenu={
        <UserMenu
          name={displayName}
          role={session.user.role}
          switchHref={session.user.memberId ? "/dashboard" : undefined}
          switchLabel="切换到会员端"
        />
      }
    >
      {children}
    </AppShell>
  );
}
