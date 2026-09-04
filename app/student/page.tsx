import { Suspense } from "react";
import LearningWorkspace from "@/components/education/LearningWorkspace";

export default function StudentPage() {
  return (
    <Suspense fallback={<p>正在读取学习记录…</p>}><LearningWorkspace /></Suspense>
  );
}
