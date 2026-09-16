"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { api, fetcher } from "@/lib/api";
import { AlertTriangle, BookOpen, Brain, Clock, Download, Languages, LayoutDashboard, Library, LogOut, RotateCcw, Users } from "lucide-react";

const items = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/learn", label: "学习", icon: BookOpen },
  { href: "/vocabulary", label: "背单词", icon: Languages },
  { href: "/sessions", label: "学习记录", icon: Clock },
  { href: "/wrong-questions", label: "错题本", icon: AlertTriangle },
  { href: "/review", label: "间隔复习", icon: RotateCcw },
  { href: "/teachers", label: "老师人格", icon: Users },
  { href: "/memories", label: "长期记忆", icon: Brain },
  { href: "/library", label: "资料库", icon: Library },
  { href: "/export", label: "数据导出", icon: Download },
];

export function AppNav() {
  const pathname = usePathname();
  const { data } = useSWR<{ user: { id: string; name: string; email: string | null } | null }>(
    "/api/auth/me",
    fetcher,
  );
  const user = data?.user;

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center px-4">
        <div className="mr-3 flex shrink-0 items-center gap-2 py-3 font-semibold">
          <span className="text-lg">📚</span>
          <span className="hidden sm:inline">个人智能学习系统</span>
        </div>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="ml-2 flex shrink-0 items-center gap-2 border-l pl-2">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
