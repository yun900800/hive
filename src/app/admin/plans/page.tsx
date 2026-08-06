import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPlans } from "@/modules/membership/application/membership-app";
import { formatYuan } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PlansPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const plans = await listPlans();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">套餐管理</h1>
        <p className="text-sm text-muted-foreground">会员订阅的套餐目录。</p>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>月费</TableHead>
              <TableHead>免费灵活时长</TableHead>
              <TableHead>说明</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.planType}</TableCell>
                <TableCell>{formatYuan(p.monthlyFeeCents)}</TableCell>
                <TableCell>{p.freeFlexHours} 小时</TableCell>
                <TableCell className="max-w-xs text-muted-foreground">{p.description}</TableCell>
                <TableCell>
                  <Badge variant={p.isActive ? "secondary" : "outline"}>
                    {p.isActive ? "启用" : "停用"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
