import { redirect } from "next/navigation";
import { ShieldCheck, Users, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { members, subscriptions, users } from "@/lib/db/schema";
import { MemberDirectory, type MemberRow } from "./member-directory";
import { PageHeader } from "@/components/patterns/page-header";
import { StatCard } from "@/components/patterns/stat-card";

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

  const rows: MemberRow[] = membersList.map((member) => {
    const sub = subByMember.get(member.id);
    const user = userByMember.get(member.id);

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      tier: member.tier,
      creditScore: member.creditScore,
      planType: sub?.planType ?? null,
      role: user?.role ?? null,
      isCurrentAdmin: user?.email === session?.user?.email,
    };
  });

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

      <MemberDirectory rows={rows} />
    </div>
  );
}
