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

  it("R4 점 네임스페이스가 id 토큰의 축약/확장이면 stutter 로 잡는다", () => {
    // clip ⊂ clipboard, folder ⊂ folderpop — 잘라낸 도메인도 restating 이라 위반.
    expect(findStutterCommands("soksak-plugin-clipboard", ["clip.copy", "clip.paste"])).toEqual([
      "clip.copy",
      "clip.paste",
    ]);
    expect(findStutterCommands("soksak-plugin-folderpop", ["folder.pop", "folder.pin"])).toEqual([
      "folder.pop",
      "folder.pin",
    ]);
  });

  it("R4 점 네임스페이스가 조작 대상 객체명이면 통과", () => {
    // node.*/page.* 는 플러그인이 아니라 다루는 객체를 이름한다 — 도메인 재진술 아님.
    expect(findStutterCommands("soksak-plugin-kanban", ["node.add", "node.move"])).toEqual([]);
    // 길이 3 미만 첫 세그먼트는 축약 매칭에서 제외(오탐 방지).
    expect(findStutterCommands("soksak-plugin-file-tree", ["ir.import"])).toEqual([]);
  });

  it("R4 bare 이름은 id 토큰과 정확히 같을 때만 잡는다", () => {
    // playbox 의 bare 'play' 는 동사 자체 — 네임스페이스 아니라서 합법.
    expect(findStutterCommands("soksak-plugin-playbox", ["play", "pause"])).toEqual([]);
    // agents-issue-create 의 bare 'create' 는 id 토큰과 exact — 위반.
    expect(findStutterCommands("soksak-plugin-agents-issue-create", ["create"])).toEqual(["create"]);
  });

  it("R4 위반은 checkPlugin 을 통해 naming 위반으로 표면화", () => {
    // good.id = soksak-plugin-file-tree → 토큰 {file, tree}. bare 'tree' 는 exact 위반.
    const r = checkPlugin({ ...good, commands: ["tree"] }, contract);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "naming")).toBe(true);
  });

  it("R5 폐기된 실패 방언(ok:false,error:)을 envelope 위반으로 잡는다", () => {
    expect(countErrorDialect('return { ok: false, error: "x" }; ok:false,error:1')).toBe(2);
    expect(countErrorDialect('return { ok: false, code: "E", message: "m" }')).toBe(0);
    const r = checkPlugin({ ...good, mainJs: 'return { ok: false, error: "nope" }' }, contract);
    expect(r.violations.some((v) => v.rule === "envelope")).toBe(true);
  });
});
