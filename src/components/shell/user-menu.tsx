import { LogOut } from "lucide-react";

import { logoutAction } from "@/modules/membership/interface/actions/auth";

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "蜂";
  return trimmed.slice(0, 1).toUpperCase();
}

export function UserMenu({
  name,
  role,
}: {
  name: string;
  role?: string | null;
}) {
  const memberLabel = role === "ADMIN" ? "管理员" : "会员";

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink ring-1 ring-brand/25">
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{memberLabel}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="退出登录"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
