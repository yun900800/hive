import { redirect } from "next/navigation";
import { ShieldCheck, Users, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { members, subscriptions, users } from "@/lib/db/schema";
import { labelOf } from "@/lib/labels";
import { MemberRoleButton } from "./member-role-button";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge } from "@/components/patterns/status-badge";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "会";
}

export default async function MembersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [membersList, subs, usersList] = await Promise.all([
    db.select().from(members).all(),
    db.select().from(subscriptions).all(),
    db.select().from(users).all(),
  ]);

  const subByMember = new Map<string, (typeof subs)[number]>();
  for (const sub of subs) {
    if (sub.status === "ACTIVE" && !subByMember.has(sub.memberId)) {
      subByMember.set(sub.memberId, sub);
    }
  }

  const userByMember = new Map<string, (typeof usersList)[number]>();
  for (const user of usersList) {
    if (user.memberId) userByMember.set(user.memberId, user);
  }

  const adminCount = usersList.filter((user) => user.role === "ADMIN").length;
  const activeSubCount = subByMember.size;

  return (
    <div className="space-y-8">
      <PageHeader
        title="会员管理"
        description="查看会员档案、订阅状态与登录账号角色。设为管理员后，该账号可访问管理后台。"
      />

      <section
        aria-label="会员概览"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="会员总数"
          value={membersList.length}
          icon={Users}
          tone="brand"
          hint="已建档会员"
        />
        <StatCard
          label="管理员账号"
          value={adminCount}
          icon={ShieldCheck}
          hint="可访问管理后台"
        />
        <StatCard
          label="生效中订阅"
          value={activeSubCount}
          icon={Wallet}
          tone="success"
          hint="当前有效套餐"
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <SectionCard
        title="会员列表"
        description={`共 ${membersList.length} 位会员，按建档顺序展示。`}
        bodyClassName="p-0"
      >
        {membersList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="还没有会员"
            description="会员注册后会出现在这里。"
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
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
                {membersList.map((member) => {
                  const sub = subByMember.get(member.id);
                  const user = userByMember.get(member.id);
                  const isCurrentAdmin =
                    user?.email === session?.user?.email;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink ring-1 ring-brand/20">
                            {initialOf(member.name)}
                          </span>
                          <div className="min-w-0 max-w-[150px] sm:max-w-none">
                            <p className="truncate text-sm font-medium">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge kind="tier" value={member.tier} />
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {member.creditScore}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {sub ? (
                          <span className="text-sm">
                            {labelOf("planType", sub.planType)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            未订阅
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {user ? (
                          <StatusBadge kind="role" value={user.role} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            无登录账号
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {user ? (
                          <div className="flex flex-col items-end gap-1">
                            <MemberRoleButton
                              memberId={member.id}
                              currentRole={user.role}
                            />
                            {isCurrentAdmin && (
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
