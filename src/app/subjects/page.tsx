import { redirect } from "next/navigation";

// 旧「科目与知识点」已融合进 /learn
export default function SubjectsPage() {
  redirect("/learn");
}
