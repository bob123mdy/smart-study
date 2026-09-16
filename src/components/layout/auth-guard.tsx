"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { usePathname, useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { AppNav } from "./app-nav";

const PUBLIC_PATHS = ["/login", "/register"];

interface MeResponse {
  user: { id: string; name: string; email: string | null } | null;
}

// 全局路由守卫：未登录访问受保护页面 → 跳转 /login；登录/注册页则直出。
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSWR<MeResponse>("/api/auth/me", fetcher);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isLoading && !isPublic && !data?.user) {
      router.replace("/login");
    }
  }, [isLoading, isPublic, data, router]);

  if (isPublic) {
    return <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>;
  }

  if (isLoading || !data?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在加载…
      </div>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
