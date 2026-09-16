import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherPersonas } from "@/db/schema";
import { ChatRoom } from "@/components/chat/chat-room";

export const dynamic = "force-dynamic";

export default async function TeacherChatPage({ params }: { params: { id: string } }) {
  const t = await db.select().from(teacherPersonas).where(eq(teacherPersonas.id, params.id)).get();
  if (!t) notFound();

  return (
    <ChatRoom
      teacher={{ id: t.id, name: t.name, type: t.type, subject: t.subject, modelTier: t.modelTier }}
    />
  );
}
