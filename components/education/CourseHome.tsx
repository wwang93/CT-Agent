"use client";
import { useState } from "react";
import Link from "next/link";
import { COURSE, GROUPS, INTERVENTIONS, TASKS, UNITS } from "@/lib/education/course";
import CourseHeader from "./CourseHeader";

export default function CourseHome() {
  const [selected, setSelected] = useState(1);
  const intervention = INTERVENTIONS.find((item) => item.id === selected)!;
  const unit = UNITS.find((item) => item.id === intervention.unitId);
  const task = intervention.unitId ? TASKS[intervention.unitId] : undefined;
  return <div className="edu-app"><CourseHeader />
    <div className="edu-topline"><span>中国学生的语言学习 × 教育心理学</span><span>{COURSE.id} · {COURSE.hours} 学时 / {COURSE.credits} 学分 · 五次干预版</span></div>
    <div className="edu-course-layout">
      <aside className="edu-map" aria-label="五次教学干预">
        <div className="edu-map-heading"><h2>五次理解之旅</h2><span>02 / 05 任务备齐</span></div>
        <p className="edu-map-note">先独立思考，再获得支持。<br />留下每一次理解的变化。</p>
        {INTERVENTIONS.map((item) => <button key={item.id} className={`edu-unit edu-intervention ${selected === item.id ? "is-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
          <span className="edu-unit-number">{String(item.id).padStart(2, "0")}</span>
          <span>{item.title}<small>{item.ready ? `Week ${item.week} · 待教师审核发布` : "待选讲义 · 尚未开放"}</small></span>
        </button>)}
        <div className="edu-provider-note"><span>模型接入</span><strong>DeepSeek 官方 API</strong><p>服务端配置后启用。学生不需要 AI 平台账号。</p></div>
      </aside>
      <main className="edu-course-main">
        <div className="edu-eyebrow">教学干预 {String(intervention.id).padStart(2, "0")}{unit ? ` / Week ${intervention.week} / 课程单元 ${unit.id}` : " / 内容待定"}</div>
        <h1>{intervention.title}</h1>
        <p className="edu-question">{unit?.question || "下一次干预将根据教师选定的讲义设计，不用占位内容替代真实课堂任务。"}</p>
        <div className="edu-tags">{(unit?.concepts || ["讲义待选", "任务待审核"]).map((concept) => <span key={concept}>{concept}</span>)}</div>
        <section className="edu-focus">
          <div className="edu-section-label">这一次，你将尝试</div>
          <h2>{task?.objective || "沿用独立初答、按需支持、自主修订、独立迁移和反思的学习结构。"}</h2>
          {task && unit ? <><p>{task.caseText}</p><div className="edu-actions">
            <Link className="edu-button" href={`/preview?unit=${unit.id}`}>预览本次任务 <span>→</span></Link>
            <Link className="edu-button secondary" href={`/student?unit=${unit.id}`}>进入正式学习</Link>
          </div><p className="edu-caption">预览不调用 AI、不保存输入、不产生研究数据。正式任务须经教师审核发布，并完成账号、数据库和模型配置。</p></>
          : <><p>第三至第五次的讲义、主题和教学周尚未确定。目前不能开始任务，也不会生成学习记录。</p><Link className="edu-text-link" href="/instructor">查看教师工作台 →</Link></>}
        </section>
        <section className="edu-learning-path"><h2>一次干预，留下可回看的理解变化</h2><ol>
          <li><b>01</b><strong>独立初答</strong><span>先记录自己的判断与证据</span></li>
          <li><b>02</b><strong>支持与修订</strong><span>AI 追问、分层提示，自主修改</span></li>
          <li><b>03</b><strong>独立迁移</strong><span>换个情境，不依赖 AI 作答</span></li>
          <li><b>04</b><strong>反思变化</strong><span>说明改了什么、依据是什么</span></li>
        </ol></section>
        <section className="edu-bottom-grid"><div><h3>教、学、研分别承担责任</h3><p>学生确认自己的作答；教师审核任务与反馈；研究仅使用有效授权的记录。对话数量不是认知水平，也不是成绩。</p></div><div><h3>课程考核保持不变</h3><div className="edu-assessment">{COURSE.assessment.map((part) => <span key={part.label}><b>{part.weight}%</b>{part.label}</span>)}</div><p className="edu-caption">由任课教师依据课程要求评定，系统不自动给分。</p></div></section>
        <details className="edu-curriculum"><summary>查看完整课程背景 · 15 单元 / 32 学时</summary><p className="edu-caption">课程单元、教学周和干预编号分别记录。课程地图不表示每个单元都安排 AI 干预。</p>
          {GROUPS.map((group, index) => <section key={group}><h3>{group}</h3><div className="edu-curriculum-units">{UNITS.filter((item) => item.group === index).map((item) => <div key={item.id}><span>{String(item.id).padStart(2, "0")} · {item.title}</span><small>{item.hours} 学时{item.ready ? " · 本轮选定" : ""}</small></div>)}</div></section>)}
        </details>
      </main>
    </div><footer className="edu-footer">教育心理学 · 五次教学干预 · 前两次依据 Week 7 / Week 10 讲义 <span>学习记录由你确认，教学判断由教师负责。</span></footer>
  </div>;
}
