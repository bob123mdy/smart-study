// 认证核心：bcrypt 密码哈希 + httpOnly session cookie（可撤销）
// 密码绝不明文存储；会话 token 只存哈希，数据库泄露也无法冒用登录态。

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, newId } from "@/db";
import { sessions, users, type User } from "@/db/schema";

const SESSION_COOKIE = "ss_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// ---- 密码哈希（bcrypt，成本因子 10）----
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string | null): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

// ---- token 哈希 ----
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ---- 会话管理 ----
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(sessions)
    .values({ id: newId(), userId, tokenHash: sha256(token), expiresAt })
    .run();
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** 从当前请求的 session cookie 解析登录用户；未登录 / 过期返回 null。 */
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .get();
  if (!session) return null;
  return (await db.select().from(users).where(eq(users.id, session.userId)).get()) ?? null;
}

/** 便捷方法：返回当前登录用户 ID，未登录返回 null。 */
export async function getUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token))).run();
  }
  cookies().delete(SESSION_COOKIE);
}

/** 去除敏感字段（passwordHash），用于返回给前端。 */
export function publicUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = user;
  return rest;
}
