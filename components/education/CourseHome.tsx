"use client";
import { useState } from "react";
import Link from "next/link";
import { COURSE, GROUPS, INTERVENTIONS, TASKS, UNITS } from "@/lib/education/course";
import CourseHeader from "./CourseHeader";

export default function CourseHome() {
  const [selected, setSelected] = useState(1);
  const activity = INTERVENTIONS.find(item => item.id === selected)!;
  const unit = UNITS.find(item => item.id === activity.unitId);
  const task = activity.unitId ? TASKS[activity.unitId] : undefined;
  return <div className="edu-app"><CourseHeader />
    <div className="edu-topline"><span>课程编号 {COURSE.id}</span><span>{COURSE.hours} 学时 · {COURSE.credits} 学分 · 5 次学习活动</span></div>
    <div className="edu-course-layout">
      <aside className="edu-map" aria-label="选择学习活动">
        <div className="edu-map-heading"><h2>学习安排</h2><span>本课程</span></div>
        <p className="edu-map-note">从自己的解释开始，<br />一步步检验和修订。</p>
        {INTERVENTIONS.map(item => <button key={item.id} className={`edu-unit edu-intervention ${item.ready ? "" : "is-pending"} ${selected === item.id ? "is-selected" : ""}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
          <span className="edu-unit-number">{String(item.id).padStart(2, "0")}</span>
          <span>{item.ready ? item.title : item.title.replace("学习","")}<small>{item.ready ? `第 ${item.week} 周 · 任务预览` : "待教师安排"}</small></span>
        </button>)}
        <div className="edu-map-help"><strong>第一次使用？</strong><p>用教师发放的学生 ID 和个人访问码登录。每次使用同一个账号，学习记录会连续保存。</p><Link href="/auth">前往课程登录 →</Link></div>
      </aside>
      <main className="edu-course-main">
        <div className="edu-eyebrow">学习活动 {String(activity.id).padStart(2, "0")}{unit ? ` · 第 ${activity.week} 周` : " · 待安排"}</div>
        <h1>{activity.title}</h1>
        <p className="edu-question">{unit?.question || "主题和任务将在教师选定讲义后公布。"}</p>
        <div className="edu-tags">{(unit?.concepts || ["讲义待定", "尚未开放"]).map(concept => <span key={concept}>{concept}</span>)}</div>
        <section className="edu-focus">
          <div className="edu-section-label">本次学习任务</div>
          <h2>{task ? task.title.replace(/^活动[一二]：/, "") : "下一次学习活动正在准备"}</h2>
          {task && unit ? <><p className="edu-home-case">{task.caseText}</p><div className="edu-objective"><span>学习目标</span><p>{task.objective}</p></div><div className="edu-actions">
            <Link className="edu-button" href={`/preview?unit=${unit.id}`}>查看任务预览 <span aria-hidden="true">→</span></Link>
            <Link className="edu-button secondary" href={`/student?unit=${unit.id}`}>进入我的学习</Link>
          </div><p className="edu-caption">预览不保存输入。正式学习将在教师审核任务并开启课堂后开放。</p></>
          : <><p>第三至第五次活动的讲义和教学周尚未确定。目前不能开始作答，不会生成学习记录。</p><Link className="edu-text-link" href="/student">查看我的学习记录 →</Link></>}
        </section>
        <section className="edu-learning-path"><h2>这一次，按四个步骤完成</h2><ol>
          <li><b>01</b><strong>独立初答</strong><span>写下最初的判断和证据</span></li>
          <li><b>02</b><strong>解释与修订</strong><span>按需查看提示、提出问题</span></li>
          <li><b>03</b><strong>独立迁移</strong><span>换个情境，独立尝试</span></li>
          <li><b>04</b><strong>学习反思</strong><span>说明改变了什么及其依据</span></li>
        </ol></section>
        <section className="edu-bottom-grid"><div><h3>关于学习记录</h3><p>回答、提示使用、答疑和教师反馈会保存在你的账号中。教师据此了解学习过程；使用次数不等于理解水平。研究参与另行自愿选择。</p></div><div><h3>课程考核</h3><div className="edu-assessment">{COURSE.assessment.map(part => <span key={part.label}><b>{part.weight}%</b>{part.label}</span>)}</div><p className="edu-caption">由任课教师依据课程要求评定。</p></div></section>
        <details className="edu-curriculum"><summary>完整课程大纲 · 15 单元</summary>{GROUPS.map((group, index) => <section key={group}><h3>{group}</h3><div className="edu-curriculum-units">{UNITS.filter(item => item.group === index).map(item => <div key={item.id}><span>{String(item.id).padStart(2, "0")} · {item.title}</span><small>{item.hours} 学时{item.ready ? " · 本轮活动" : ""}</small></div>)}</div></section>)}</details>
      </main>
    </div><footer className="edu-footer"><span>教育心理学 · 课程学习空间</span><span>任务依据第 7 周、第 10 周讲义编写，正式使用前由教师审核。</span></footer>
  </div>;
}
