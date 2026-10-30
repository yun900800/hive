"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import {
  scanAccessAction,
  type ActionState,
} from "@/modules/access/interface/actions/access";

const initialState: ActionState = {};

export type ScanPassOption = {
  code: string;
  validFrom: Date;
  validTo: Date;
};

/** 模拟扫码表单 */
export function ScanForm({ activePasses }: { activePasses: ScanPassOption[] }) {
  const [state, action, pending] = useActionState(scanAccessAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="passCode">通行证编码</Label>
        <select
          id="passCode"
          name="passCode"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-sm"
          required
        >
          {activePasses.length === 0 ? (
            <option value="">暂无可用通行证</option>
          ) : (
            activePasses.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}（{formatDateTime(p.validFrom)} ~ {formatDateTime(p.validTo)}）
              </option>
            ))
          )}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gateName">闸机</Label>
        <Input id="gateName" name="gateName" placeholder="如：东区入口1号闸机" defaultValue="东区入口1号闸机" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="direction">方向</Label>
        <select
          id="direction"
          name="direction"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="ENTRY">进入</option>
          <option value="EXIT">离开</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="accessTime">模拟时间（可选）</Label>
        <Input id="accessTime" name="accessTime" type="datetime-local" step={60} />
        <p className="text-xs text-muted-foreground">
          留空＝当前时间，按北京时间解释。模拟入场会消耗该通行证（置为已使用）；
          可分别测「未到生效时间 / 已放行 / 已过期」。
        </p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending || activePasses.length === 0}>
        {pending ? "校验中…" : "模拟扫码"}
      </Button>
    </form>
  );
}
