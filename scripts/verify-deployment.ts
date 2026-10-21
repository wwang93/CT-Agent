/** Read-only hosting smoke test. No credentials, DB writes or model calls. */
import { pathToFileURL } from "node:url";

type Check = { name: string; passed: boolean; status?: number };
type Configuration = {
  authConfigured: boolean;
  databaseConfigured: boolean;
  aiConfigured: boolean;
  classroomEnabled: boolean;
};
type DeploymentReport = {
  target: string;
  kind: "read-only-deployment-smoke";
  passed: boolean;
  configuration: Configuration | null;
  checks: Check[];
  limitations: string[];
};

export function deploymentOrigin(input: string) {
  const url = new URL(input);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
    throw new Error("请提供无路径、凭证和查询参数的 HTTPS 站点地址；HTTP 仅限本机测试。");
  }
  return url.origin;
}

export async function verifyDeployment(input: string, options: {
  fetcher?: typeof fetch;
  requireConfigured?: boolean;
} = {}): Promise<DeploymentReport> {
  const target = deploymentOrigin(input);
  const fetcher = options.fetcher ?? fetch;
  const checks: Check[] = [];
  let configuration: Configuration | null = null;
  const assets = new Set<string>();
  const request = (path: string, init?: RequestInit) => fetcher(`${target}${path}`, {
    ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60_000),
  });
  async function check(name: string, run: () => Promise<{ passed: boolean; status?: number }>) {
    try { checks.push({ name, ...await run() }); }
    catch { checks.push({ name, passed: false }); } // Never print response bodies or tokens.
  }

  for (const path of ["/", "/auth", "/preview?unit=6", "/preview?unit=10", "/student", "/instructor", "/research"]) {
    await check(`page:${path}`, async () => {
      const response = await request(path);
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="([^"<>]+)"/g)) {
        const url = new URL(match[1].replaceAll("&amp;", "&"), target);
        if (url.origin === target && url.pathname.startsWith("/_next/static/") && /\.(js|css)$/.test(url.pathname)) assets.add(url.pathname);
      }
      const marker = path === "/auth" ? "个人访问码" : path.startsWith("/preview") ? "课程样板" : "教育心理学";
      return { passed: response.status === 200 && response.headers.get("content-type")?.includes("text/html") === true && html.includes(marker), status: response.status };
    });
  }

  checks.push({ name: "next-assets-discovered", passed: assets.size > 0 });
  for (const path of [...assets].slice(0, 4)) {
    await check(`asset:${path}`, async () => {
      const response = await request(path);
      const passed = response.status === 200 && !response.headers.get("content-type")?.includes("text/html");
      await response.body?.cancel();
      return { passed, status: response.status };
    });
  }

  await check("runtime-configuration", async () => {
    const response = await request("/api/education/status");
    const data = await response.json();
    const shape = typeof data.databaseConfigured === "boolean" && typeof data.aiConfigured === "boolean" && typeof data.classroomEnabled === "boolean";
    configuration = {
      authConfigured: Boolean(data.authUrl && data.authKey),
      databaseConfigured: data.databaseConfigured === true,
      aiConfigured: data.aiConfigured === true,
      classroomEnabled: data.classroomEnabled === true,
    };
    const configured = !options.requireConfigured || (configuration.authConfigured && configuration.databaseConfigured && configuration.aiConfigured);
    return { passed: response.status === 200 && shape && configured && /no-store/i.test(response.headers.get("cache-control") ?? ""), status: response.status };
  });

  for (const path of ["/api/me", "/api/education", "/api/education?view=learningIds", "/api/education?view=teaching", "/api/education?view=research", "/api/education?view=administration"]) {
    await check(`anonymous-denied:${path}`, async () => {
      const response = await request(path);
      const data = await response.json();
      return { passed: response.status === 401 && typeof data.error === "string" && /no-store/i.test(response.headers.get("cache-control") ?? ""), status: response.status };
    });
  }

  // Empty/malformed input is rejected before looking up an ID or consuming a DB limiter.
  await check("login-input-validation", async () => {
    const response = await request("/api/education/learning-login", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: target }, body: "[]",
    });
    await response.body?.cancel();
    return { passed: response.status === 400 && /no-store/i.test(response.headers.get("cache-control") ?? ""), status: response.status };
  });
  await check("cross-origin-login-denied", async () => {
    const response = await request("/api/education/learning-login", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://cross-origin-test.invalid" }, body: "{}",
    });
    await response.body?.cancel();
    return { passed: response.status === 403, status: response.status };
  });

  return {
    target, kind: "read-only-deployment-smoke", passed: checks.every((item) => item.passed), configuration, checks,
    limitations: ["未登录真实账号", "未读取或写入学生记录", "未调用模型", "未验证大陆网络", "不是100人并发验收"],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const index = args.indexOf("--target");
  if (index < 0 || !args[index + 1]) {
    console.error("用法：npm run test:deployment -- --target https://你的测试站点 [--require-configured]");
    process.exitCode = 1;
  } else {
    verifyDeployment(args[index + 1], { requireConfigured: args.includes("--require-configured") }).then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exitCode = 1;
    }).catch(() => { console.error("验收未执行：请检查测试站点地址；不会输出凭证或原始响应。"); process.exitCode = 1; });
  }
}
