import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { members, subscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MemberRoleButton } from "./member-role-button";

export default async function MembersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const membersList = await db.select().from(members).all();
  const subs = await db.select().from(subscriptions).all();
  const usersList = await db.select().from(users).all();

  const subByMember = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (s.status === "ACTIVE" && !subByMember.has(s.memberId)) subByMember.set(s.memberId, s);
  }
  const userByMember = new Map<string, (typeof usersList)[number]>();
  for (const u of usersList) {
    if (u.memberId) userByMember.set(u.memberId, u);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">会员管理</h1>
        <p className="text-sm text-muted-foreground">
          会员档案、订阅状态与登录账号角色一览。设为管理员后，该账号可访问管理后台。
        </p>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>等级</TableHead>
              <TableHead>信用分</TableHead>
              <TableHead>当前套餐</TableHead>
              <TableHead>账号角色</TableHead>
              <TableHead className="w-36">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membersList.map((m) => {
              const sub = subByMember.get(m.id);
              const user = userByMember.get(m.id);
              const isCurrentAdmin = user?.email === session?.user?.email;
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.tier === "PLATINUM" ? "default" : "secondary"}>
                      {m.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.creditScore}</TableCell>
                  <TableCell>{sub ? sub.planType : "未订阅"}</TableCell>
                  <TableCell>
                    {user ? (
                      <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                        {user.role === "ADMIN" ? "管理员" : "普通会员"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">无登录账号</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user && !isCurrentAdmin ? (
                      <MemberRoleButton memberId={m.id} currentRole={user.role} />
                    ) : isCurrentAdmin ? (
                      <span className="text-xs text-muted-foreground">当前登录账号</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {membersList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  暂无会员
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
