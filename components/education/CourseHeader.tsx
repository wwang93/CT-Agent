import Link from "next/link";
export default function CourseHeader({ active = "course" }: { active?: string }) {
  return <header className="edu-header"><Link href="/" className="edu-brand" aria-label="教育心理学课程首页"><span className="edu-brand-mark" aria-hidden="true">心</span><span className="edu-brand-name">教育心理学<small>课程学习空间</small></span></Link><nav aria-label="主导航">{[["/", "课程安排", "course"], ["/student", "我的学习", "student"], ["/instructor", "教学管理", "instructor"], ["/research", "研究资料", "research"]].map(([href, text, key]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{text}</Link>)}</nav><Link className="edu-account" href="/auth">{active === "auth" ? "课程登录" : "登录 / 切换账号"}</Link></header>;
}
