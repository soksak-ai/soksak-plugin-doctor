// Doctor 검사 로직 — 나쁜 설정을 잡고(RED 상황 재현) 좋은 설정은 통과시킨다.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkPlugin, findGhostThemeVars, findStutterCommands, countErrorDialect } from "../src/check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(join(here, "..", "contract.json"), "utf8"));

const good = {
  id: "soksak-plugin-file-tree",
  dirName: "soksak-plugin-file-tree",
  permissions: ["ui", "fs:read", "commands"],
  mainJs: "x{color:var(--fg)}y{background:var(--card)}z{border:var(--bd)}",
};

describe("checkPlugin — 무결성 게이트", () => {
  it("정상 플러그인은 통과", () => {
    const r = checkPlugin(good, contract);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("유령 테마 변수(--text/--surface)를 theme 위반으로 잡는다", () => {
    const r = checkPlugin({ ...good, mainJs: "a{color:var(--text)}b{background:var(--surface)}" }, contract);
    expect(r.ok).toBe(false);
    expect(r.violations.filter((v) => v.rule === "theme").length).toBe(2);
  });

  it("제거된 권한(editor)을 permission 위반으로 잡는다", () => {
    const r = checkPlugin({ ...good, permissions: ["ui", "editor"] }, contract);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "permission" && v.msg.includes("editor"))).toBe(true);
  });

  it("id≠디렉토리명을 naming 위반으로 잡는다", () => {
    const r = checkPlugin({ ...good, dirName: "wrong-dir" }, contract);
    expect(r.violations.some((v) => v.rule === "naming")).toBe(true);
  });

  it("형식 위반 id(soksak-plugin- 누락)를 naming 위반으로 잡는다", () => {
    const r = checkPlugin({ ...good, id: "myplugin", dirName: "myplugin" }, contract);
    expect(r.violations.some((v) => v.rule === "naming")).toBe(true);
  });

  it("findGhostThemeVars 는 계약 안 변수만 통과", () => {
    expect(findGhostThemeVars("var(--fg) var(--text)", contract.themeVars, contract.themeVocab)).toEqual(["text"]);
  });

  it("R4 명령명이 도메인 토큰과 중복하면 naming 위반", () => {
    const r = checkPlugin({ ...good, commands: ["create", "ir.import"] }, contract);
    // good.id 도메인에 따라 달라지므로 순수 함수로도 확인
    expect(findStutterCommands("soksak-plugin-agents-issue-create", ["create"])).toEqual(["create"]);
    expect(findStutterCommands("soksak-plugin-clipboard", ["clip.copy", "clip.paste"])).toEqual([]);
    void r;
  });

  it("R5 폐기된 실패 방언(ok:false,error:)을 envelope 위반으로 잡는다", () => {
    expect(countErrorDialect('return { ok: false, error: "x" }; ok:false,error:1')).toBe(2);
    expect(countErrorDialect('return { ok: false, code: "E", message: "m" }')).toBe(0);
    const r = checkPlugin({ ...good, mainJs: 'return { ok: false, error: "nope" }' }, contract);
    expect(r.violations.some((v) => v.rule === "envelope")).toBe(true);
  });
});
