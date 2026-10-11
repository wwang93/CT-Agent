"use client";
import { useEffect, useState } from "react";
import { ADMINISTRATION_ACCESS_VERSION, COURSE_ADMINISTRATION_NOTICE, TEACHING_NOTICE_DRAFT, withCourseAdministrationNotice } from "@/lib/education/privacy";
import type { TeachingPrivacy } from "@/lib/education/types";
import { educationApi } from "./useEducation";
export default function TeachingPrivacyEditor({ current, onSaved }: { current?: TeachingPrivacy; onSaved: () => Promise<void> }) {
  const [notice, setNotice] = useState(withCourseAdministrationNotice(current?.notice ?? TEACHING_NOTICE_DRAFT)), [contact, setContact] = useState(current?.contact ?? ""), [retention, setRetention] = useState(current?.retention ?? ""), [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { setNotice(withCourseAdministrationNotice(current?.notice ?? TEACHING_NOTICE_DRAFT)); setContact(current?.contact ?? ""); setRetention(current?.retention ?? ""); setReviewed(false); }, [current?.version]);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try { await educationApi("", { action: "teachingPrivacy", notice, contact, retention, reviewed }); await onSaved(); setMessage("教学记录说明已保存。学生须阅读确认新版本；研究同意仍独立选择。"); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="edu-panel"><h2>开课前的教学记录说明</h2>
    <p>说明草稿已准备，但不会代你确认。填写实际联系渠道、保存期限和到期处理安排，核实学校的数据使用要求后保存。这里的期限只是你告知的处理安排，系统不会自动删除；请按安排执行，不要承诺尚未具备的自动清理。</p>
    <div className="edu-callout"><strong>必须告知的全班记录查看范围</strong><p>{COURSE_ADMINISTRATION_NOTICE}</p>{current && current.administrationAccessVersion !== ADMINISTRATION_ACCESS_VERSION && <p>原说明尚未包含本次权限变更，请重新确认。确认前学生不能开始或继续正式任务。</p>}</div>
    <label htmlFor="teaching-notice">教学用途、访问范围、答疑与数据处理说明<textarea id="teaching-notice" rows={7} maxLength={4000} value={notice} onChange={(e) => { setNotice(e.target.value); setReviewed(false); }} disabled={busy} /></label>
    <label htmlFor="teaching-contact">学生联系渠道<input id="teaching-contact" maxLength={200} value={contact} onChange={(e) => { setContact(e.target.value); setReviewed(false); }} placeholder="填写课程教师的实际联系渠道" disabled={busy} /></label>
    <label htmlFor="teaching-retention">保存期限及到期处理安排<textarea id="teaching-retention" rows={3} maxLength={1000} value={retention} onChange={(e) => { setRetention(e.target.value); setReviewed(false); }} placeholder="明确期限、责任人和处理方式；不填写学生个人资料" disabled={busy} /></label>
    <label className="edu-check"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={busy} />我已核实说明、学校数据使用要求与实际保存安排，并确认联系渠道有效。</label>
    <button className="edu-button secondary" onClick={() => { void save(); }} disabled={busy || !reviewed || !notice.trim() || !contact.trim() || !retention.trim()}>保存并发布教学记录说明</button>
    <p className="edu-caption">{current ? `当前已确认版本：v${current.version}。修改后学生需重新阅读确认。` : "尚未确认：即使管理员打开课堂开关，服务端也不会允许新开正式任务。"} 教学说明确认不代表同意参加研究。</p>
    {error && <p role="alert" className="edu-inline-error">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
