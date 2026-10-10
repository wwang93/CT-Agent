import Link from "next/link";
export default function AccessNotice({ loading, error, mismatch, onRetry }: { loading?: boolean; error?: string; mismatch?: string; onRetry?: () => void }) {
  return <section className="edu-access"><div className="edu-eyebrow">课程访问</div><h1>{loading ? "正在读取课程记录…" : mismatch ? "请使用对应的课程身份" : "登录后，继续你的学习"}</h1><p role={error ? "alert" : undefined}>{error || mismatch || "学生使用教师发放的学习 ID 和个人访问码，无需邮箱注册。教师与研究者身份由管理员分配。"}</p><div className="edu-actions"><Link href="/auth" className="edu-button">登录课程账号</Link><Link href="/preview?unit=6" className="edu-button secondary">查看任务预览</Link>{onRetry && <button className="edu-button secondary" onClick={onRetry}>重新读取</button>}</div></section>;
}
