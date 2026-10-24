import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  DoorOpen,
  LayoutDashboard,
  ScanLine,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  Wallet,
  Armchair,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type ShellVariant = "member" | "admin";

const MEMBER_NAV: NavGroup[] = [
  {
    label: "工作台",
    items: [{ href: "/dashboard", label: "概览", icon: LayoutDashboard }],
  },
  {
    label: "预订",
    items: [
      { href: "/bookings", label: "我的预订", icon: CalendarDays },
      { href: "/bookings/desk", label: "订工位", icon: Armchair },
      { href: "/bookings/room", label: "订会议室", icon: DoorOpen },
    ],
  },
  {
    label: "使用",
    items: [
      { href: "/flex", label: "灵活区", icon: Sparkles },
      { href: "/access", label: "通行证", icon: Ticket },
      { href: "/notifications", label: "通知", icon: Bell },
    ],
  },
  {
    label: "账户",
    items: [
      { href: "/subscription", label: "订阅套餐", icon: Wallet },
      { href: "/billing", label: "账单", icon: CreditCard },
      { href: "/profile", label: "个人中心", icon: UserRound },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: "概览",
    items: [{ href: "/admin", label: "经营总览", icon: LayoutDashboard }],
  },
  {
    label: "空间",
    items: [{ href: "/admin/facility", label: "空间资源", icon: Building2 }],
  },
  {
    label: "会员",
    items: [
      { href: "/admin/members", label: "会员管理", icon: Users },
      { href: "/admin/plans", label: "套餐管理", icon: Sparkles },
    ],
  },
  {
    label: "运营",
    items: [
      { href: "/admin/billing", label: "账单管理", icon: CreditCard },
      { href: "/admin/access", label: "通行管理", icon: ScanLine },
      { href: "/admin/reports", label: "经营报表", icon: BarChart3 },
    ],
  },
];

export function getNavGroups(variant: ShellVariant): NavGroup[] {
  return variant === "admin" ? ADMIN_NAV : MEMBER_NAV;
}

/** 取当前路径命中的最具体导航项（用于高亮与标题） */
export function findActiveItem(
  pathname: string,
  variant: ShellVariant
): NavItem | undefined {
  const items = getNavGroups(variant).flatMap((group) => group.items);
  return items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
