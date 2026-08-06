import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listRecentAccessLogs } from "@/modules/access/application/access-app";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { gatePasses } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminAccessPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [logs, [passCount]] = await Promise.all([
    listRecentAccessLogs(200),
    db.select({ v: count() }).from(gatePasses),
  ]);

  const granted = logs.filter((l) => l.result === "GRANTED").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">通行管理</h1>
        <p className="text-sm text-muted-foreground">通行记录与通行证情况（模拟扫码）。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">通行证总数</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{passCount.v}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">通行记录</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{logs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">放行次数</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{granted}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近通行记录</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>会员</TableHead>
                <TableHead>闸机</TableHead>
                <TableHead>方向</TableHead>
                <TableHead>结果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    暂无通行记录
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.accessTime)}</TableCell>
                    <TableCell>{l.memberId ? l.memberId.slice(0, 8) : "—"}</TableCell>
                    <TableCell>{l.gateName}</TableCell>
                    <TableCell>{l.direction}</TableCell>
                    <TableCell>
                      <Badge variant={l.result === "GRANTED" ? "default" : "destructive"}>{l.result}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
