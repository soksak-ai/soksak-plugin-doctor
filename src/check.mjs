// soksak 플러그인 무결성 검사 — 순수 로직(fs 없음, 재사용·테스트 용이).
// 계약 데이터의 단일 소스는 코어다(contract.json = 코어 themeVarContract()+PERMISSIONS 발행본).
// 여기 로직은 그 계약을 강제할 뿐 계약을 새로 만들지 않는다.

// 변수 이름의 시맨틱 뿌리 — 끝 숫자/-숫자 제거(bg2→bg, text-2→text).
function themeRoot(name) {
  return name.replace(/-?\d+$/, "");
}

// 텍스트(번들 main.js 등)에서 "유령" 테마 변수를 찾는다.
// 유령 = var(--X) 로 참조됐지만 (a) 코어 계약에 없고 (b) 자체 정의(--X:)하지도 않고
// (c) 호스트 테마 의미 어휘(vocab)에 속하는 이름 — "코어 토큰을 의도했는데 코어가 안 주는" 것.
// 라이브러리/사적 변수(radix-*, trees-*, color-blue-500, gap …)는 어휘 밖이라 유령 아님(false positive 방지).
export function findGhostThemeVars(text, themeVars, themeVocab = []) {
  const allow = new Set(themeVars);
  const vocab = new Set(themeVocab);
  const isHostToken = (v) => vocab.has(v) || vocab.has(themeRoot(v));
  const defined = new Set();
  for (const m of text.matchAll(/--([a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  const ghosts = new Set();
  for (const m of text.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
    const v = m[1];
    if (!allow.has(v) && !defined.has(v) && isHostToken(v)) ghosts.add(v);
  }
  return [...ghosts].sort();
}

// 명령명이 플러그인 id 의 도메인 토큰과 정확 중복하는지(NAMING §1). id=soksak-plugin-<도메인>,
// 명령 첫 세그먼트가 도메인 토큰과 exact 일치면 동어반복(예: agents-issue-create.create). 축약
// 네임스페이스(clipboard→clip.*)는 exact 아니라 허용. 반환 = 위반 명령명 목록.
export function findStutterCommands(id, commands = []) {
  const domain = id.replace(/^soksak-plugin-/, "");
  const tokens = new Set(domain.split("-"));
  return commands.filter((name) => tokens.has(String(name).split(".")[0]));
}

// 폐기된 실패 방언(ok:false,error:) 정적 스캔 — 표준은 {ok:false,code,message}(MESSAGE-PROTOCOL §3).
// 번들 텍스트에서 반환형 경계의 error: 를 센다(catch 반환의 일부 포함 — 저자가 code/message 로 이전할 신호).
export function countErrorDialect(text) {
  return (text.match(/ok:\s*false\s*,\s*error:/g) || []).length;
}

// 한 플러그인을 계약에 대해 검사. 입력은 이미 읽힌 값(순수). violations[] 비면 통과.
//   plugin: { id, permissions, mainJs, dirName, commands }
//   contract: { idPattern, permissions, themeVars, specVersion }
export function checkPlugin(plugin, contract) {
  const violations = [];
  const { id, permissions = [], mainJs = "", dirName, commands = [] } = plugin;

  // R1 명명 — 형식(soksak-plugin- kebab) + id===디렉토리명.
  if (!new RegExp(contract.idPattern).test(id)) {
    violations.push({ rule: "naming", msg: `id "${id}" 가 ${contract.idPattern} 위반` });
  }
  if (dirName && id !== dirName) {
    violations.push({ rule: "naming", msg: `id "${id}" 가 디렉토리명 "${dirName}" 와 불일치` });
  }

  // R2 권한 존재 — 선언 권한은 전부 코어 계약 안. 코어에서 사라진 권한(예: 추출된 editor) 차단.
  const allowPerm = new Set(contract.permissions);
  for (const p of permissions) {
    if (!allowPerm.has(p)) {
      violations.push({ rule: "permission", msg: `알 수 없는/제거된 권한 "${p}" (코어 계약에 없음)` });
    }
  }

  // R3 테마 계약 — 번들 CSS 가 코어가 주는 테마 변수만 참조(유령=폴백색=테마 미적용).
  const ghosts = findGhostThemeVars(mainJs, contract.themeVars, contract.themeVocab);
  for (const g of ghosts) {
    violations.push({ rule: "theme", msg: `유령 테마 변수 --${g} (코어가 주지 않음 → 폴백색, 테마 미적용)` });
  }

  // R4 명명 중복 — 명령 세그먼트가 플러그인 도메인 토큰과 동어반복(NAMING §1).
  for (const name of findStutterCommands(id, commands)) {
    violations.push({ rule: "naming", msg: `명령 "${name}" 이 도메인 토큰과 중복 — 세그먼트를 도메인과 달리 지으세요` });
  }

  // R5 실패 방언 — 폐기된 ok:false,error: 잔존(표준=code/message, MESSAGE-PROTOCOL §3).
  const dialect = countErrorDialect(mainJs);
  if (dialect > 0) {
    violations.push({ rule: "envelope", msg: `폐기된 실패 방언 ok:false,error: ${dialect}건 — {ok:false,code,message} 로 이전하세요` });
  }

  return { id, ok: violations.length === 0, violations };
}
