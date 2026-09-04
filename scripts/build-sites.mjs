import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const project = process.cwd();
if (!fs.existsSync(path.join(project, ".openai/hosting.json"))) throw new Error("Sites project is not registered");
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
console.log("Sites Worker and client assets prepared in dist/.");
