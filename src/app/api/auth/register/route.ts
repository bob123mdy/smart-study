import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import { seedUser } from "@/db/seed";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const password = (body?.password ?? "").toString();

  if (!name) return NextResponse.json({ error: "请填写昵称" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });

  const exists = await db.select().from(users).where(eq(users.email, email)).get();
  if (exists) return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });

  const id = newId();
  await db
    .insert(users)
    .values({
      id,
      name,
      email,
      passwordHash: hashPassword(password),
      role: "user",
      timezone: "Asia/Shanghai",
    })
    .run();

  // 新用户开箱即用：预设老师 + 示例科目 + 示例目标
  await seedUser(id, name);

  await createSession(id);

  const user = (await db.select().from(users).where(eq(users.id, id)).get())!;
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
