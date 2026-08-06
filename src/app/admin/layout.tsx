import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/modules/membership/interface/actions/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "概览" },
  { href: "/admin/facility", label: "空间资源" },
  { href: "/admin/members", label: "会员管理" },
  { href: "/admin/plans", label: "套餐管理" },
  { href: "/admin/billing", label: "账单管理" },
  { href: "/admin/access", label: "通行管理" },
  { href: "/admin/reports", label: "报表" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/admin" className="text-lg font-bold">
            蜂巢 <span className="text-amber-500">管理后台</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session.user.name}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                退出
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
