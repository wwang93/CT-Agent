import { Suspense } from "react";
import LearningWorkspace from "@/components/education/LearningWorkspace";
export default function PreviewPage() { return <Suspense fallback={<p>正在打开课程样板…</p>}><LearningWorkspace preview /></Suspense>; }
