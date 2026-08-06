import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listMyGatePasses,
  listMyAccessLogs,
} from "@/modules/access/application/access-app";
import { formatDateTime } from "@/lib/format";
import { ScanForm } from "./scan-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PASS_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  USED: "secondary",
  EXPIRED: "secondary",
  REVOKED: "destructive",
};

export default async function AccessPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const memberId = session.user.memberId;
  const [passes, logs] = await Promise.all([
    listMyGatePasses(memberId),
    listMyAccessLogs(memberId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">我的通行证</h1>
        <p className="text-sm text-muted-foreground">
          预订确认后自动生成通行证。扫码为模拟操作，记录通行日志。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>通行证列表</CardTitle>
            <CardDescription>有效时段内可通行（模拟扫码）</CardDescription>
          </CardHeader>
          <CardContent>
            {passes.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                暂无通行证。去 <a href="/bookings" className="underline">预订工位</a> 后自动生成。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编码</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>有效时段</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell>{p.gatePassType}</TableCell>
                      <TableCell>
                        {formatDateTime(p.validFrom)} ~ {formatDateTime(p.validTo)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PASS_STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>模拟扫码</CardTitle>
            <CardDescription>输入通行证编码验证通行</CardDescription>
          </CardHeader>
          <CardContent>
            <ScanForm activePasses={passes.filter((p) => p.status === "ACTIVE").map((p) => p.code)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>通行记录</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">暂无通行记录。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>闸机</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead>结果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.accessTime)}</TableCell>
                    <TableCell>{l.gateName}</TableCell>
                    <TableCell>{l.direction}</TableCell>
                    <TableCell>
                      <Badge variant={l.result === "GRANTED" ? "default" : "destructive"}>{l.result}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
