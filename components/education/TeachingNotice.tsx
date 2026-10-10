"use client";
import { useState } from "react";
import type { TeachingPrivacy } from "@/lib/education/types";
export default function TeachingNotice({ privacy, acknowledged, busy, onAcknowledge }: { privacy?: TeachingPrivacy; acknowledged: boolean; busy: boolean; onAcknowledge: () => Promise<void> }) {
  const [read, setRead] = useState(false);
  if (!privacy) return <section className="edu-panel"><h2>教学记录说明待教师确认</h2><p>教师需明确教学用途、联系渠道与保存安排，之后才能开始正式学习。任务预览不保存输入。</p></section>;
  return <section className="edu-panel"><h2>教学记录说明</h2><details open={!acknowledged}><summary>{acknowledged ? "已阅读本版说明 · 展开查看" : "开始学习前请阅读"}</summary><p className="edu-prewrap">{privacy.notice}</p><h3>保存及处理安排</h3><p className="edu-prewrap">{privacy.retention}</p><h3>联系渠道</h3><p className="edu-prewrap">{privacy.contact}</p></details>
    {!acknowledged && <><label className="edu-check"><input type="checkbox" checked={read} disabled={busy} onChange={(e) => setRead(e.target.checked)} />我已阅读教学记录说明。这不是研究参与同意，研究使用另行自愿选择。</label><button className="edu-button secondary" disabled={busy || !read} onClick={() => { void onAcknowledge(); }}>确认已阅读</button></>}
  </section>;
}
