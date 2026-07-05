#!/usr/bin/env node
// soksak-plugin-doctor — 플러그인 무결성 게이트. 배포 전 통과 필수.
// 사용: soksak-plugin-doctor [pluginDir]   (기본: 현재 디렉토리)
// 계약은 vendored contract.json(코어 발행본). 위반 시 비-0 종료 → prepublish 차단.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlugin } from "../src/check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] || process.cwd());

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const contract = JSON.parse(read(join(here, "..", "contract.json")));
const manifestRaw = read(join(target, "plugin.json"));
if (!manifestRaw) {
  console.error(`✗ doctor: ${target}/plugin.json 없음 — soksak 플러그인 디렉토리가 아님`);
  process.exit(2);
}
const manifest = JSON.parse(manifestRaw);
const mainJs = read(join(target, manifest.entry || "main.js"));
if (!mainJs) {
  console.error(`✗ doctor: 빌드 산출물(${manifest.entry || "main.js"}) 없음 — 먼저 빌드하세요`);
  process.exit(2);
}
// 소스 텍스트(방언·message 정적 스캔용 — 번들은 minify 되어 정적 스캔 불가). src/ 있으면 전 .ts
// (테스트 제외) 이어 붙인다. 없으면 undefined → checkPlugin 이 mainJs 로 폴백(hand-authored).
import { readdirSync, statSync } from "node:fs";
function collectSrc(dir) {
  let out = "";
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out += collectSrc(p);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(e) && !e.includes(".test.")) out += "\n" + read(p);
  }
  return out;
}
const srcDir = join(target, "src");
const srcText = existsSync(srcDir) ? collectSrc(srcDir) : undefined;

const commandNames = ((manifest.contributes && manifest.contributes.commands) || []).map((c) => c.name);
const r = checkPlugin(
  { id: manifest.id, permissions: manifest.permissions, mainJs, dirName: basename(target), commands: commandNames, srcText },
  contract,
);

if (r.ok) {
  console.log(`✓ doctor: ${r.id} — 무결성 통과 (contract ${contract.specVersion})`);
  process.exit(0);
}
console.error(`✗ doctor: ${r.id} — 위반 ${r.violations.length}건`);
for (const v of r.violations) console.error(`  [${v.rule}] ${v.msg}`);
process.exit(1);
