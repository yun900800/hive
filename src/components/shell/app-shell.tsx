"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Hexagon, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  findActiveItem,
  getNavGroups,
  type ShellVariant,
} from "./nav-config";

type AppShellProps = {
  variant: ShellVariant;
  /** 侧栏底部的用户区域（服务端渲染，含退出登录表单） */
  userMenu: React.ReactNode;
  children: React.ReactNode;
};

const VARIANT_META: Record<
  ShellVariant,
  { home: string; badge: string; label: string }
> = {
  member: { home: "/dashboard", badge: "会员中心", label: "会员中心" },
  admin: { home: "/admin", badge: "管理后台", label: "管理后台" },
};

export function AppShell({ variant, userMenu, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = findActiveItem(pathname, variant);
  const meta = VARIANT_META[variant];

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-1 focus:ring-border"
      >
        跳到主要内容
      </a>

      {/* 桌面侧栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent variant={variant} pathname={pathname} userMenu={userMenu} />
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="关闭导航菜单"
            className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="导航菜单"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl"
          >
            <button
              type="button"
              aria-label="关闭导航菜单"
              className="absolute right-3 top-4 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent
              variant={variant}
              pathname={pathname}
              userMenu={userMenu}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="打开导航菜单"
            aria-expanded={mobileOpen}
            className="grid size-9 place-items-center rounded-lg text-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
              <Hexagon className="size-3 text-brand-strong lg:hidden" aria-hidden />
              {meta.label}
            </p>
            <p className="truncate text-sm font-semibold">
              {active?.label ?? meta.badge}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={variant === "admin" ? "/admin/access" : "/notifications"}
              aria-label={variant === "admin" ? "通行记录" : "通知中心"}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-[18px]" aria-hidden />
            </Link>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  variant,
  pathname,
  userMenu,
  onNavigate,
}: {
  variant: ShellVariant;
  pathname: string;
  userMenu: React.ReactNode;
  /** 移动端点击导航后关闭抽屉 */
  onNavigate?: () => void;
}) {
  const groups = getNavGroups(variant);
  const meta = VARIANT_META[variant];
  const activeHref = groups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <Link
        href={meta.home}
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-2.5 px-5"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm">
          <Hexagon className="size-5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight">蜂巢</span>
          <span className="block text-[11px] font-medium text-brand-strong">
            {meta.badge}
          </span>
        </span>
      </Link>

      <nav aria-label="主导航" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="mt-5 first:mt-2">
            <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground/80">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-strong"
                        />
                      )}
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive ? "text-brand-strong" : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">{userMenu}</div>
    </>
  );
}
