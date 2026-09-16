"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin ? { email, password } : { name, email, password };
      await api(url, { method: "POST", body: JSON.stringify(body) });
      // 整页跳转，让 session cookie 生效并刷新全部数据
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{isLogin ? "登录" : "注册新账号"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "登录后继续你的学习进度"
              : "注册即开箱即用：预设 5 位老师 + 示例科目"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">昵称</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的昵称"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "你的密码" : "至少 6 位"}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "处理中…" : isLogin ? "登录" : "注册"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <span className="text-muted-foreground">{isLogin ? "还没有账号？" : "已有账号？"}</span>
          <Link href={isLogin ? "/register" : "/login"} className="text-primary hover:underline">
            {isLogin ? "去注册" : "去登录"}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
