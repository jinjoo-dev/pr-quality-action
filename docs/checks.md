# 검사 항목 상세

## 개요

이 Action은 PR의 **변경된 라인에 해당하는 오류만** 보고합니다.  
변경하지 않은 기존 코드의 오류는 무시합니다.

---

## TypeScript 타입 체크

프로젝트의 `tsconfig.json`을 그대로 사용해 TypeScript 컴파일러를 실행합니다.  
monorepo 환경에서는 모든 `tsconfig.json`을 탐색하여 변경 파일이 포함된 영역만 검사합니다.

### Severity

| TypeScript 카테고리 | Severity |
|---|---|
| `Error` | 🔴 Blocking |
| `Warning` / `Message` | 🟡 Warning |

### 검출 범위

TypeScript 컴파일러가 보고하는 모든 오류가 대상입니다. 주요 예시:

| 코드 | 설명 |
|---|---|
| `TS2322` | 타입 불일치 (`Type 'X' is not assignable to type 'Y'`) |
| `TS2339` | 존재하지 않는 프로퍼티 접근 |
| `TS2345` | 함수 인자 타입 불일치 |
| `TS2304` | 선언되지 않은 이름 참조 |
| `TS2551` | 오타 가능성이 있는 프로퍼티 참조 |
| `TS7006` | 암묵적 `any` 파라미터 |
| `TS7031` | 구조 분해 바인딩의 암묵적 `any` |
| `TS2488` | `[Symbol.iterator]` 미구현 타입의 구조 분해 |
| `TS2307` (로컬) | 로컬 상대 경로 모듈을 찾을 수 없음 |
| 그 외 모든 TS 오류 | 컴파일러 설정에 따라 다름 |

### 의도적으로 제외되는 항목 (환경 노이즈)

CI 환경에서 의존성 미설치로 인해 발생하는 오탐을 방지하기 위해 아래 항목은 필터링됩니다.

| 코드 | 설명 | 제외 이유 |
|---|---|---|
| `TS2307` (외부 패키지) | `Cannot find module 'react'` 등 | `node_modules` 미설치 환경 노이즈 |
| `TS7026` | `JSX IntrinsicElements` 없음 | `@types/react` 미설치 환경 노이즈 |

> **참고**: 워크플로우에 `npm ci` / `pnpm install` 단계를 추가하면 위 오류도 정상적으로 검출됩니다.

---

## ESLint

프로젝트에 설치된 **ESLint 설정 파일을 그대로 사용**합니다.  
이 Action이 규칙을 직접 정의하지 않으므로, 검출되는 규칙은 **각 프로젝트의 ESLint 설정에 따라 다릅니다**.

### 지원 설정 형식

| 형식 | 파일 | ESLint 버전 |
|---|---|---|
| Flat config | `eslint.config.js` / `.mjs` / `.cjs` / `.ts` | ESLint 9+ (기본) |
| Legacy config | `.eslintrc.js` / `.json` / `.yaml` / `.yml` / `.eslintrc` | ESLint 8 이하 |

프로젝트 루트에서 설정 파일을 자동 감지합니다.  
Legacy 형식이 감지되면 `ESLINT_USE_FLAT_CONFIG=false`를 자동으로 설정합니다.

### Severity

| ESLint severity | Severity |
|---|---|
| `error` (2) | 🔴 Blocking |
| `warn` (1) | 🟡 Warning |

### 일반적으로 검출되는 규칙 예시

프로젝트 설정에 따라 다르지만, Next.js / React 프로젝트에서 흔히 사용되는 규칙:

| 규칙 | 설명 |
|---|---|
| `@typescript-eslint/no-unused-vars` | 사용하지 않는 변수 |
| `@typescript-eslint/no-explicit-any` | 명시적 `any` 사용 |
| `react-hooks/rules-of-hooks` | Hook 사용 규칙 위반 |
| `react-hooks/exhaustive-deps` | `useEffect` 의존성 누락 |
| `no-console` | `console.log` 사용 |
| `import/no-duplicates` | 중복 import |

---

## 동작 방식 요약

```
PR 열림 / 커밋 푸시
  └─ git diff (base...head)
       └─ 변경된 JS/TS 파일 목록 + 변경된 라인 번호 추출
            ├─ TypeScript 컴파일러 실행 → 오류 중 변경된 라인만 수집
            └─ ESLint 실행 → 오류 중 변경된 라인만 수집
                 └─ Blocking 있으면 PR에 라인 코멘트 + 요약 코멘트
                    Blocking 없으면 🟢 통과
```
