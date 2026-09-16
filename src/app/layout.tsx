import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PwaRegister } from "@/components/pwa/pwa-register";

export const metadata: Metadata = {
  title: "个人智能学习系统",
  description: "无 AI 也能完整使用的学习进度 / 目标 / 复习系统",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "学习系统",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-muted/30">
        <AuthGuard>{children}</AuthGuard>
        <PwaRegister />
      </body>
    </html>
  );
}
