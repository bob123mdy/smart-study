"use client";

import { useEffect } from "react";

// 注册 Service Worker（PWA 安装/离线/自动更新）。
// 仅在 secure context（HTTPS 或 localhost）下成功；纯 HTTP 局域网下浏览器会拒绝，静默忽略即可。
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
