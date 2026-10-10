"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CourseHeader from "@/components/education/CourseHeader";
import { getConfiguredSupabaseClient } from "@/lib/supabase-browser";
import { roleLandingPath } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export default function AuthPage() {
  const router = useRouter();
  const [entry, setEntry] = useState<"learning" | "email">("learning");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [learnerId, setLearnerId] = useState(""), [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [signedIn, setSignedIn] = useState(false), [landing, setLanding] = useState("/student");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [identity, setIdentity] = useState("");
  async function identify(token: string) {
    const response = await fetch("/api/education", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "登录身份暂时无法读取，请重新登录。");
    const path = roleLandingPath(payload.user.role as UserRole);
    setLanding(path); setIdentity(payload.user.role === "student" ? `学习 ID：${payload.user.learnerCode}` : payload.user.role === "instructor" ? `教师身份：${payload.user.learnerCode}` : "研究者账号");
    setSignedIn(true);
    return path;
  }
  useEffect(() => { let active = true; getConfiguredSupabaseClient().then(async (client) => {
    const token = (await client.auth.getSession()).data.session?.access_token;
    if (token && active) await identify(token);
  }).catch((err) => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const client = await getConfiguredSupabaseClient();
      if (entry === "learning") {
        const response = await fetch("/api/education/learning-login", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ learnerId, accessCode }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "登录失败，请稍后重试。");
        const { data, error } = await client.auth.setSession(payload.session);
        if (error || !data.session) throw new Error("登录会话未能保存，请重试。");
        setAccessCode(""); router.push(await identify(data.session.access_token));
      } else if (mode === "signup") {
        if (password.length < 8 || password !== confirm) throw new Error("密码至少 8 位，且两次输入需一致。");
        const { error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setPassword(""); setConfirm(""); setMessage("请检查邮箱验证邮件，再登录。新账号只有学生权限；教师身份须由管理员核验后配置。");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/reset-password` });
        if (error) throw error; setMessage("若账号可接收邮件，请按邮件链接重置密码。学习 ID 访问码请联系教师重置。");
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) throw new Error("尚未取得登录会话，请重试。");
        setPassword(""); router.push(await identify(data.session.access_token));
      }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function switchEntry(value: "learning" | "email") { setEntry(value); setError(""); setMessage(""); setAccessCode(""); setPassword(""); setConfirm(""); }
  return <div className="edu-app"><CourseHeader active="auth" /><main className="edu-auth">
    <div className="edu-eyebrow">课程登录 / EDUCATIONAL PSYCHOLOGY</div><h1>回到你的学习现场</h1>
    <p>学生和教师都可以用固定 ID 与个人访问码登录，无需邮箱。学生使用老师发放的学习 ID，教师 ID 由管理员预先配置。</p>
    <section className="edu-panel">{signedIn ? <><h2>你已经登录</h2><p>{identity}</p><div className="edu-actions"><Link className="edu-button" href={landing}>进入工作台</Link><button className="edu-button secondary" disabled={busy} onClick={async () => {
      setBusy(true); try { const { error } = await (await getConfiguredSupabaseClient()).auth.signOut(); if (error) throw error; setSignedIn(false); setIdentity(""); setAccessCode(""); setMessage("已退出登录。公共设备请不要保存访问码。"); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>退出 / 切换账号</button></div></> : <>
      <div className="edu-tabs" role="group" aria-label="登录方式"><button disabled={busy} className={entry === "learning" ? "active" : ""} onClick={() => switchEntry("learning")}>学生 / 教师 ID</button><button disabled={busy} className={entry === "email" ? "active" : ""} onClick={() => switchEntry("email")}>已有邮箱账号</button></div>
      {entry === "email" && <div className="edu-tabs">{([["signin", "邮箱登录"], ["forgot", "忘记密码"], ["signup", "创建邮箱账号"]] as const).map(([id, name]) => <button disabled={busy} className={mode === id ? "active" : ""} key={id} onClick={() => { setMode(id); setError(""); setMessage(""); }}>{name}</button>)}</div>}
      <form onSubmit={submit}>{entry === "learning" ? <>
        <label htmlFor="learning-id">学习 / 教师 ID</label><input id="learning-id" name="username" required autoComplete="username" autoCapitalize="characters" spellCheck={false} maxLength={24} placeholder="学生 L-001 / 教师 T-001" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} disabled={busy} />
        <label htmlFor="learning-code">个人访问码</label><input id="learning-code" name="password" type="password" required autoComplete="current-password" minLength={12} maxLength={128} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={busy} />
        <p className="edu-caption">访问码固定使用，不是短信验证码。学生忘记时联系教师，教师访问码由管理员重置；ID 和历史记录保留。请勿分享访问码，公共设备使用后退出登录。</p>
      </> : <>
        <label htmlFor="email">邮箱</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        {mode !== "forgot" && <><label htmlFor="password">密码</label><input id="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></>}
        {mode === "signup" && <><label htmlFor="confirm">再次输入密码</label><input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} /><p className="edu-caption">新学生请直接使用学习 ID。教师与研究者权限由管理员配置，不能通过注册提升权限。</p></>}
      </>}<button className="edu-button" disabled={busy} type="submit">{busy ? "正在处理…" : entry === "learning" ? "使用 ID 登录" : mode === "signin" ? "登录课程" : mode === "signup" ? "创建邮箱账号" : "发送重置邮件"}</button></form>
    </>}{error && <p className="edu-inline-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}</section>
    <Link className="edu-text-link" href="/preview">先看看教学脚手架 →</Link>
  </main></div>;
}
