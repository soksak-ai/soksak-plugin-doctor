# soksak-plugin-doctor

soksak 플러그인 무결성 게이트. 배포 전에 돌린다 — 비-0 종료면 배포 차단.

한 플러그인을 **코어 발행 계약**(`contract.json` — 코어가 자기 테마 엔진과 권한 목록에서 생성)에 대해
검사한다. 모든 규칙의 단일 소스가 코어라서(플러그인마다 복붙하지 않음) 생태계가 일관되게 유지된다.

## 사용

```
npx soksak-plugin-doctor [pluginDir]   # 기본: 현재 디렉토리
```

플러그인에 배선해 배포를 게이트한다:

```json
{
  "scripts": { "prepublishOnly": "soksak-plugin-doctor", "doctor": "soksak-plugin-doctor" },
  "devDependencies": { "soksak-plugin-doctor": "github:soksak-ai/soksak-plugin-doctor" }
}
```

먼저 플러그인을 빌드(검사는 번들 `main.js` 를 읽는다)한 뒤 `npm run doctor`.

## 규칙

| 규칙 | 강제 내용 |
|------|-----------|
| `naming` | `id` 가 `soksak-plugin-<세그먼트>`(소문자 kebab) 형식 + 디렉토리명과 일치 |
| `permission` | 선언 권한이 전부 코어 계약에 존재(코어가 제거한 권한 차단 — 예: capability 가 플러그인으로 빠진 뒤 남은 토큰) |
| `theme` | 번들이 코어가 실제로 emit 하는 테마 변수만 참조. 코어가 안 주는 호스트 토큰 이름(`--text`/`--surface`/`--accent`/`--bg2` 등)을 참조하면 "유령" — 조용히 폴백색으로 떨어져 코어 테마가 적용되지 않는다. 라이브러리/사적 변수(`--radix-*`/`--color-blue-500`/`--gap`/자체 정의 `--x:`)는 무시. |

## 계약 단일 소스

`contract.json` 은 여기서 작성하지 않고 **코어가 생성**한다. 코어가 테마 엔진(`COLOR_SLOTS`)과 권한
목록(`PERMISSIONS`)을 소유하고 `contract.json` 을 발행하며, 파일이 코어와 어긋나면 핀 테스트가 실패한다.
이 패키지는 코어 `src/plugins/contract.json` 의 복사본을 vendoring 한다(레지스트리와 같은 캐시 모델).

## 테스트

```
npm install
npm test
```
