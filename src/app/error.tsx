"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600">
        <RotateCcw className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">页面加载失败</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          可能是网络波动或服务暂时不可用。你可以重试，若问题持续出现请联系管理员。
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-[11px] text-muted-foreground/70">
            错误编号：{error.digest}
          </p>
        )}
      </div>
      <Button variant="brand" onClick={reset}>
        重新加载
      </Button>
    </div>
  );
}
