import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDesks, listMeetingRooms, listFlexZones, listGates } from "@/modules/facility/application/facility-app";
import { formatYuan } from "@/lib/format";
import { DeskForm } from "./desk-form";
import { RoomForm } from "./room-form";
import { DeleteButton } from "./delete-button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const deskTypeLabels: Record<string, string> = {
  STANDARD: "标准位",
  WINDOW_SIDE: "靠窗",
  QUIET_ZONE: "静区",
  STANDING: "站立位",
};

function deskTypeLabel(type: string): string {
  return deskTypeLabels[type] ?? type;
}

export default async function FacilityPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [desks, rooms, zones, gates] = await Promise.all([
    listDesks(),
    listMeetingRooms(),
    listFlexZones(),
    listGates(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">空间资源管理</h1>
        <p className="text-sm text-muted-foreground">维护工位、会议室等空间设施。</p>
      </div>

      <Tabs defaultValue="desks">
        <TabsList>
          <TabsTrigger value="desks">工位（{desks.length}）</TabsTrigger>
          <TabsTrigger value="rooms">会议室（{rooms.length}）</TabsTrigger>
          <TabsTrigger value="zones">灵活区（{zones.length}）</TabsTrigger>
          <TabsTrigger value="gates">闸机（{gates.length}）</TabsTrigger>
        </TabsList>

        <TabsContent value="desks" className="space-y-4">
          <DeskForm />
          <div className="rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>楼层</TableHead>
                  <TableHead>分区</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desks.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono">{d.code}</TableCell>
                    <TableCell>{d.floor} 层</TableCell>
                    <TableCell>{d.zone}</TableCell>
                    <TableCell>{deskTypeLabel(d.type)}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "AVAILABLE" ? "secondary" : "outline"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton kind="desk" id={d.id} label={d.code} />
                    </TableCell>
                  </TableRow>
                ))}
                {desks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      暂无工位，请先添加
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomForm />
          <div className="rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>容量</TableHead>
                  <TableHead>设备</TableHead>
                  <TableHead>时租</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.capacity} 人</TableCell>
                    <TableCell>{r.equipments.join("、") || "—"}</TableCell>
                    <TableCell>{formatYuan(r.hourlyRateCents)}/时</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "AVAILABLE" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton kind="room" id={r.id} label={r.name} />
                    </TableCell>
                  </TableRow>
                ))}
                {rooms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      暂无会议室，请先添加
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="zones">
          <div className="rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>容量</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>{z.name}</TableCell>
                    <TableCell>{z.capacity} 人</TableCell>
                    <TableCell>{z.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="gates">
          <div className="rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>位置</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gates.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.name}</TableCell>
                    <TableCell>{g.floor} 层 · {g.zone}</TableCell>
                    <TableCell>{g.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
