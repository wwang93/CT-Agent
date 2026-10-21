import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { deploymentOrigin, verifyDeployment } from "../scripts/verify-deployment";

test("EdgeOne uses the full Next build, a bounded runtime and private API caching", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../edgeone.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(config.installCommand, "npm ci");
  assert.equal(config.buildCommand, "npm run build:edgeone");
  assert.equal(pkg.scripts["build:edgeone"], "next build");
  assert.equal(config.outputDirectory, ".next", "must not publish only static files or the Sites worker");
  assert.equal(config.cloudFunctions.nodejs.maxDuration, 60, "allow DB work around the 30 second model timeout");
  assert.deepEqual(config.cloudFunctions.overseasRegions, ["ap-singapore"]);
  const api = config.headers.find((rule: { source: string }) => rule.source === "/api/*");
  assert.equal(api.headers.find((header: { key: string }) => header.key === "Cache-Control").value, "private, no-store");
  assert.ok(!JSON.stringify(config).includes("DEEPSEEK_API_KEY"));
});

test("smoke destination requires an explicit HTTPS origin, no credentials or query tokens", () => {
  assert.equal(deploymentOrigin("https://test.example.com"), "https://test.example.com");
  assert.equal(deploymentOrigin("http://127.0.0.1:3014"), "http://127.0.0.1:3014");
  for (const value of ["http://example.com", "https://user:secret@example.com", "https://example.com/?token=secret", "https://example.com/auth", "https://example.com/#secret"]) assert.throws(() => deploymentOrigin(value));
});

function hostingFixture(options: { configured?: boolean; exposeRecords?: boolean; cacheStatus?: boolean; htmlOnly?: boolean } = {}) {
  const calls: { path: string; method: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), path = `${url.pathname}${url.search}`;
    assert.equal(url.origin, "https://test.example.com");
    assert.equal(init?.redirect, "error");
    assert.ok(!new Headers(init?.headers).has("authorization"), "never sends account credentials");
    calls.push({ path, method: init?.method ?? "GET" });
    if (options.htmlOnly || !url.pathname.startsWith("/api/")) {
      if (url.pathname.startsWith("/_next/static/")) return new Response("/* asset */", { headers: { "Content-Type": "text/css" } });
      return new Response('<html>教育心理学 个人访问码 课程样板<link href="/_next/static/test.css" rel="stylesheet"></html>', { headers: { "Content-Type": "text/html" } });
    }
    const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store" };
    if (url.pathname === "/api/education/status") {
      const configured = options.configured ?? true;
      return new Response(JSON.stringify({ authUrl: configured ? "https://db.example.com" : "", authKey: configured ? "public-value-not-to-print" : "", databaseConfigured: configured, aiConfigured: configured, classroomEnabled: false }), { headers: { ...headers, ...(options.cacheStatus ? { "Cache-Control": "public, max-age=3600" } : {}) } });
    }
    if (url.pathname === "/api/education/learning-login") {
      assert.ok(["[]", "{}"].includes(String(init?.body)), "only deliberately invalid login requests");
      return new Response("{}", { status: new Headers(init?.headers).get("origin") === "https://test.example.com" ? 400 : 403, headers });
    }
    return new Response(JSON.stringify({ error: "请先登录课程账号。" }), { status: options.exposeRecords ? 200 : 401, headers });
  };
  return { fetcher, calls };
}

test("read-only smoke checks pages, assets, runtime configuration and anonymous authorization", async () => {
  const fixture = hostingFixture();
  const report = await verifyDeployment("https://test.example.com", { fetcher: fixture.fetcher, requireConfigured: true });
  assert.equal(report.passed, true);
  assert.ok(report.checks.length >= 18);
  assert.ok(!JSON.stringify(report).includes("public-value-not-to-print"));
  assert.ok(fixture.calls.filter((call) => call.method === "POST").every((call) => call.path === "/api/education/learning-login"));
  assert.ok(!fixture.calls.some((call) => call.path.includes("chat/completions")));
});

test("a static-only upload, exposed records, cached configuration or missing secrets cannot pass readiness", async () => {
  for (const options of [{ htmlOnly: true }, { exposeRecords: true }, { cacheStatus: true }, { configured: false }]) {
    const report = await verifyDeployment("https://test.example.com", { fetcher: hostingFixture(options).fetcher, requireConfigured: true });
    assert.equal(report.passed, false);
  }
  const preview = await verifyDeployment("https://test.example.com", { fetcher: hostingFixture({ configured: false }).fetcher });
  assert.equal(preview.passed, true, "unconfigured preview is allowed but never reported as ready");
  assert.equal(preview.configuration?.databaseConfigured, false);
});
