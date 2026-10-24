"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="zh-CN">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          margin: 0,
          padding: "24px",
          background: "#faf8f5",
          color: "#2b2622",
          fontFamily:
            '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 13, letterSpacing: 2, color: "#a06a1f" }}>
            蜂巢共享办公
          </p>
          <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>
            应用遇到了一点问题
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6b6259" }}>
            页面未能正常渲染。请刷新重试；如果反复出现，请联系管理员并附上错误编号。
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#9a9188",
                marginTop: 8,
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: "#e3a53a",
              color: "#2b2622",
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
