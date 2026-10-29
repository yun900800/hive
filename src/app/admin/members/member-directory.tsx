"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";

import { labelOf } from "@/lib/labels";
import { MemberRoleButton } from "./member-role-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/patterns/empty-state";
import { SectionCard } from "@/components/patterns/section-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  tier: string;
  creditScore: number;
  planType: string | null;
  role: string | null;
  isCurrentAdmin: boolean;
};

const TIER_VALUES = ["BASIC", "SILVER", "GOLD", "PLATINUM"] as const;

const TIER_ITEMS: Record<string, string> = {
  ALL: "全部等级",
  ...Object.fromEntries(TIER_VALUES.map((tier) => [tier, labelOf("tier", tier)])),
};

const ROLE_ITEMS: Record<string, string> = {
  ALL: "全部角色",
  ADMIN: "管理员",
  MEMBER: "普通会员",
  NONE: "无登录账号",
};

const SUBSCRIPTION_ITEMS: Record<string, string> = {
  ALL: "全部订阅状态",
  ACTIVE: "已订阅",
  NONE: "未订阅",
};

function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "会";
}

export function MemberDirectory({ rows }: { rows: MemberRow[] }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [subscription, setSubscription] = useState("ALL");

  const hasFilters =
    query.trim() !== "" ||
    tier !== "ALL" ||
    role !== "ALL" ||
    subscription !== "ALL";

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (
        keyword &&
        !`${row.name} ${row.email}`.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (tier !== "ALL" && row.tier !== tier) return false;
      if (role === "NONE" && row.role) return false;
      if (role !== "ALL" && role !== "NONE" && row.role !== role) return false;
      if (subscription === "ACTIVE" && !row.planType) return false;
      if (subscription === "NONE" && row.planType) return false;
      return true;
    });
  }, [rows, query, tier, role, subscription]);

  function resetFilters() {
    setQuery("");
    setTier("ALL");
    setRole("ALL");
    setSubscription("ALL");
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="筛选会员"
        description="按姓名、邮箱、等级、角色或订阅状态筛选，结果即时更新。"
        action={
          <span
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            共 {filteredRows.length} 位
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 xl:items-end">
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label htmlFor="member-search">搜索</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="member-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索姓名或邮箱"
                className="h-11 pl-9 sm:h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-tier">等级</Label>
            <Select
              value={tier}
              onValueChange={(value) => setTier(value ?? "ALL")}
              items={TIER_ITEMS}
            >
              <SelectTrigger id="member-tier" className="h-11 w-full sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIER_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-role">角色</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value ?? "ALL")}
              items={ROLE_ITEMS}
            >
              <SelectTrigger id="member-role" className="h-11 w-full sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-subscription">订阅状态</Label>
            <Select
              value={subscription}
              onValueChange={(value) => setSubscription(value ?? "ALL")}
              items={SUBSCRIPTION_ITEMS}
            >
              <SelectTrigger id="member-subscription" className="h-11 w-full sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUBSCRIPTION_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:min-h-0"
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              <RotateCcw className="mr-1.5 size-4" aria-hidden />
              重置
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="会员列表"
        description={`共 ${filteredRows.length} 位会员${
          hasFilters ? `（全部 ${rows.length} 位）` : ""
        }，按建档顺序展示。`}
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="还没有会员"
            description="会员注册后会出现在这里。"
            className="border-0 bg-transparent"
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="没有符合条件的会员"
            description="试试调整搜索词、等级、角色或订阅状态。"
            className="border-0 bg-transparent"
            action={
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={resetFilters}
                className="min-h-11 sm:min-h-0"
              >
                清除筛选
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border/70 sm:hidden">
              {filteredRows.map((row) => (
                <li key={row.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink ring-1 ring-brand/20">
                      {initialOf(row.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </p>
                    </div>
                    <StatusBadge kind="tier" value={row.tier} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">信用分</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {row.creditScore}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">当前套餐</dt>
                      <dd className="mt-0.5 font-medium">
                        {row.planType
                          ? labelOf("planType", row.planType)
                          : "未订阅"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">账号角色</dt>
                      <dd className="mt-0.5 font-medium">
                        {row.role ? (
                          <StatusBadge kind="role" value={row.role} />
                        ) : (
                          "无登录账号"
                        )}
                      </dd>
                    </div>
                  </dl>

                  {row.role && (
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <span className="text-xs text-muted-foreground">
                        {row.isCurrentAdmin ? "当前登录账号" : "账号操作"}
                      </span>
                      <MemberRoleButton
                        memberId={row.id}
                        currentRole={row.role}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden sm:block">
            <Table containerClassName="lg:overflow-x-clip">
              <TableHeader className="sticky top-16 z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead>会员</TableHead>
                  <TableHead className="hidden sm:table-cell">等级</TableHead>
                  <TableHead className="hidden md:table-cell">信用分</TableHead>
                  <TableHead className="hidden sm:table-cell">当前套餐</TableHead>
                  <TableHead className="hidden lg:table-cell">账号角色</TableHead>
                  <TableHead className="w-36 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink ring-1 ring-brand/20">
                          {initialOf(row.name)}
                        </span>
                        <div className="min-w-0 max-w-[150px] sm:max-w-none">
                          <p className="truncate text-sm font-medium">
                            {row.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge kind="tier" value={row.tier} />
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {row.creditScore}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {row.planType ? (
                        <span className="text-sm">
                          {labelOf("planType", row.planType)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          未订阅
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {row.role ? (
                        <StatusBadge kind="role" value={row.role} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          无登录账号
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.role ? (
                        <div className="flex flex-col items-end gap-1">
                          <MemberRoleButton
                            memberId={row.id}
                            currentRole={row.role}
                          />
                          {row.isCurrentAdmin && (
                            <span className="text-[11px] text-muted-foreground">
                              当前登录账号
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
