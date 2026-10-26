"use client";

import { useCallback } from "react";
import { toast } from "sonner";

type FeedbackState = { error?: string; success?: string };

export function notifySuccess(message: string, id?: string) {
  toast.success(message, { id });
}

export function notifyError(message: string, id?: string) {
  toast.error(message, { id });
}

/**
 * 包装 useActionState 的 action：服务端返回后统一弹出成功/失败 toast。
 * 固定 id 让同一操作的重复结果替换而不是堆叠。
 */
export function useActionWithToast<State extends FeedbackState>(
  action: (prev: State, formData: FormData) => Promise<State>,
  {
    successMessage,
    id,
  }: {
    successMessage: string;
    id: string;
  }
) {
  return useCallback(
    async (prev: State, formData: FormData): Promise<State> => {
      const next = await action(prev, formData);

      if (next.error) {
        notifyError(next.error, id);
      } else {
        notifySuccess(next.success ?? successMessage, id);
      }

      return next;
    },
    [action, successMessage, id]
  );
}
