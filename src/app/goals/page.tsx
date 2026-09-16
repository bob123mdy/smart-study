import { redirect } from "next/navigation";

// 旧「目标与计划」已融合进 /learn
export default function GoalsPage() {
  redirect("/learn");
}
