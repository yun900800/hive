import { redirect } from "next/navigation";
import { Building2, DoorOpen, ScanLine, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import {
  listDesks,
  listMeetingRooms,
  listFlexZones,
  listGates,
} from "@/modules/facility/application/facility-app";
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
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
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

function TabCount({ value }: { value: number }) {
  return (
    <span className="ml-1.5 rounded-full bg-background/80 px-1.5 text-[11px] tabular-nums text-muted-foreground ring-1 ring-border">
      {value}
    </span>
  );
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
      <PageHeader
        title="空间资源管理"
        description="维护工位、会议室、灵活办公区与闸机设备。新增资源会立即出现在会员端预订页。"
      />

      <Tabs defaultValue="desks" className="gap-6">
        <TabsList
          className="grid w-full grid-cols-2 gap-1 bg-muted/60 p-1 sm:inline-flex sm:w-fit"
          style={{ height: "auto" }}
        >
          <TabsTrigger value="desks" className="px-3 py-1.5">
            工位 <TabCount value={desks.length} />
          </TabsTrigger>
          <TabsTrigger value="rooms" className="px-3 py-1.5">
            会议室 <TabCount value={rooms.length} />
          </TabsTrigger>
          <TabsTrigger value="zones" className="px-3 py-1.5">
            灵活区 <TabCount value={zones.length} />
          </TabsTrigger>
          <TabsTrigger value="gates" className="px-3 py-1.5">
            闸机 <TabCount value={gates.length} />
          </TabsTrigger>
        </TabsList>

        {/* 工位 */}
        <TabsContent value="desks" className="space-y-5">
          <DeskForm />

          <SectionCard
            title="工位列表"
            description={`共 ${desks.length} 个工位，状态由预订与签到流程自动更新。`}
            bodyClassName="p-0"
          >
            {desks.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="还没有工位"
                description="使用上方表单添加第一个工位，会员即可开始预订。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编号</TableHead>
                      <TableHead className="hidden sm:table-cell">楼层</TableHead>
                      <TableHead className="hidden sm:table-cell">分区</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-20 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {desks.map((desk) => (
                      <TableRow key={desk.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {desk.code}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {desk.floor} 层
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {desk.zone} 区
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="deskType" value={desk.type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="deskStatus" value={desk.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            kind="desk"
                            id={desk.id}
                            label={desk.code}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 会议室 */}
        <TabsContent value="rooms" className="space-y-5">
          <RoomForm />

          <SectionCard
            title="会议室与独立办公室"
            description={`共 ${rooms.length} 间，时租用于会议室计费。`}
            bodyClassName="p-0"
          >
            {rooms.length === 0 ? (
              <EmptyState
                icon={DoorOpen}
                title="还没有会议室"
                description="添加会议室或独立办公室后，会员即可按小时预订。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead className="hidden sm:table-cell">类型</TableHead>
                      <TableHead className="hidden sm:table-cell">容量</TableHead>
                      <TableHead className="hidden xl:table-cell">设备</TableHead>
                      <TableHead>时租</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-20 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">
                          {room.name}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge kind="roomType" value={room.type} />
                        </TableCell>
                        <TableCell className="hidden tabular-nums sm:table-cell">
                          {room.capacity} 人
                        </TableCell>
                        <TableCell className="hidden max-w-52 truncate text-muted-foreground xl:table-cell">
                          {room.equipments.join("、") || "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatYuan(room.hourlyRateCents)} / 时
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="roomStatus" value={room.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            kind="room"
                            id={room.id}
                            label={room.name}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 灵活区 */}
        <TabsContent value="zones">
          <SectionCard
            title="灵活办公区"
            description={`共 ${zones.length} 个区域，会员到场后可签到计时。`}
            bodyClassName="p-0"
          >
            {zones.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="还没有灵活区"
                description="灵活区需要在种子数据或后续版本中配置。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>容量</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">
                          {zone.name}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {zone.capacity} 人
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="zoneStatus" value={zone.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* 闸机 */}
        <TabsContent value="gates">
          <SectionCard
            title="闸机设备"
            description={`共 ${gates.length} 台设备，用于通行记录与扫码核销。`}
            bodyClassName="p-0"
          >
            {gates.length === 0 ? (
              <EmptyState
                icon={ScanLine}
                title="还没有闸机"
                description="闸机设备需要在种子数据或后续版本中配置。"
                className="border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gates.map((gate) => (
                      <TableRow key={gate.id}>
                        <TableCell className="font-medium">
                          {gate.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {gate.floor} 层 · {gate.zone} 区
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="gateStatus" value={gate.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
