import Link from "next/link";
export default function CourseHeader({ active = "course" }: { active?: string }) {
  return <header className="edu-header"><Link href="/" className="edu-brand">CT<span>·</span>AGENT <span className="edu-edition">教育心理学</span></Link><nav aria-label="主导航">{[["/", "五次教学干预", "course"], ["/student", "我的学习", "student"], ["/instructor", "教师工作台", "instructor"], ["/research", "研究记录", "research"]].map(([href, text, key]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{text}</Link>)}</nav><Link className="edu-account" href="/auth">课程账号 ↗</Link></header>;
}
