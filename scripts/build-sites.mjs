import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
const project = process.cwd();
if (!fs.existsSync(path.join(project, ".openai/hosting.json"))) throw new Error("Sites project is not registered");
// OpenNext otherwise embeds all .env* values as fallback runtime values.
// Sites supplies server secrets through its runtime bindings, never the archive.
const compiledEnv = path.join(project, ".open-next/cloudflare/next-env.mjs");
if (!fs.existsSync(compiledEnv)) throw new Error("Build OpenNext before packaging Sites");
fs.writeFileSync(compiledEnv, "export const production = {};\nexport const development = {};\nexport const test = {};\n");
const sensitiveValues = new Set();
for (const name of [".env", ".env.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local", ".env.test", ".env.test.local"]) {
  const file = path.join(project, name);
  if (!fs.existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, "utf8")))) {
    if (!key.startsWith("NEXT_PUBLIC_") && /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)$/i.test(key) && value.length >= 8) sensitiveValues.add(value);
  }
}
for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith("NEXT_PUBLIC_") && /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)$/i.test(key) && value?.length >= 8) sensitiveValues.add(value);
}
// Only replace this script's generated build artifacts, never source or data.
const output = path.join(project, "dist");
if (fs.existsSync(output)) fs.rmSync(output, { recursive: true });
fs.mkdirSync(path.join(output, "server"), { recursive: true });
const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "deploy", "--dry-run", "--outdir", "dist/server"], { stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
if (result.status !== 0) process.exit(result.status ?? 1);
fs.renameSync(path.join(output, "server/worker.js"), path.join(output, "server/index.js"));
fs.cpSync(path.join(project, ".open-next/assets"), path.join(output, "client"), { recursive: true });
fs.mkdirSync(path.join(output, ".openai"), { recursive: true });
fs.copyFileSync(path.join(project, ".openai/hosting.json"), path.join(output, ".openai/hosting.json"));
function checkArtifacts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkArtifacts(file);
    else {
      const content = fs.readFileSync(file);
      if ([...sensitiveValues].some((value) => content.includes(Buffer.from(value)))) throw new Error(`Secret found in generated artifact: ${path.relative(output, file)}`);
    }
  }
}
checkArtifacts(output);
console.log("Sites Worker and client assets prepared in dist/.");
