import { ESLint, type Linter } from 'eslint';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPlugin = any;
import path from 'path';
import fs from 'fs';
import type { DiffMap, Finding } from '../types';

/**
 * 프로젝트 설정과 무관하게 항상 실행되는 내장 ESLint 규칙 세트.
 *
 * 프로젝트에 ESLint가 없거나 설정이 달라도 아래 규칙은 항상 검사된다.
 * 프로젝트 config runner(runner.ts)와 병렬로 실행되며 findings가 합산된다.
 *
 * 규칙 선정 기준: 버그 가능성이 높고 오탐이 적은 것만.
 *
 * 타입 정보가 필요한 규칙(@typescript-eslint/no-floating-promises 등)은
 * tsconfig.json이 있을 때만 활성화된다. 없으면 해당 규칙만 건너뛴다.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reactHooksPlugin = require('eslint-plugin-react-hooks') as AnyPlugin;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const promisePlugin = require('eslint-plugin-promise') as AnyPlugin;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin') as AnyPlugin;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const typescriptParser = require('@typescript-eslint/parser') as Linter.Parser;

/** 타입 정보 없이 실행 가능한 기본 규칙 */
function buildBaseConfig(): Linter.Config<Linter.RulesRecord>[] {
  return [
    {
    plugins: {
      'react-hooks': reactHooksPlugin,
      promise: promisePlugin,
    },
    rules: {
      // React Hooks — 잘못된 Hook 호출은 런타임 오류로 직결
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // 비동기 실수 — 조용히 씹히는 Promise 오류 방지
      'no-async-promise-executor': 'error',

      // 코드 흐름 — 도달 불가능한 코드, finally 오용
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',

      // 미선언 변수
      'no-undef': 'error',

      // Promise 체인 — 항상 return 또는 throw
      'promise/always-return': 'error',
    },
    },
  ];
}

/** tsconfig가 있을 때만 활성화되는 타입 정보 필요 규칙 */
function buildTypeAwareConfig(): Linter.Config<Linter.RulesRecord>[] {
  return [
    {
      plugins: {
        '@typescript-eslint': typescriptEslintPlugin,
      },
      languageOptions: {
        parser: typescriptParser,
        parserOptions: {
          project: true,
        },
      },
      rules: {
        // 처리되지 않은 Promise — await 빠뜨린 실수
        '@typescript-eslint/no-floating-promises': 'error',
        // Promise를 받는 자리에 일반 함수 전달 등
        '@typescript-eslint/no-misused-promises': 'error',
      },
    },
  ];
}

function findTsconfig(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, 'tsconfig.json'));
}

async function runWithConfig(
  files: string[],
  config: Linter.Config<Linter.RulesRecord>[],
  cwd: string,
  label: string,
): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    overrideConfigFile: true, // 프로젝트 설정 무시, 내장 config만 사용
    overrideConfig: config,
    errorOnUnmatchedPattern: false,
    cwd,
  });

  try {
    return await eslint.lintFiles(files);
  } catch (err) {
    console.warn(
      `[eslint/builtin] ${label} 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

export async function runBuiltinEslint(diffMap: DiffMap): Promise<Finding[]> {
  const findings: Finding[] = [];
  const filePaths = [...diffMap.keys()].filter((f) =>
    /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(f),
  );

  if (filePaths.length === 0) return findings;

  const cwd = process.cwd();
  const hasTsconfig = findTsconfig(cwd);

  console.log(
    `[eslint/builtin] 내장 규칙 검사 시작 (${filePaths.length}개 파일, tsconfig: ${hasTsconfig ? '있음' : '없음'})`,
  );

  // 기본 규칙 실행
  const baseResults = await runWithConfig(filePaths, buildBaseConfig(), cwd, '기본 규칙');

  // 타입 정보 규칙 실행 (tsconfig 있을 때만)
  const typeResults = hasTsconfig
    ? await runWithConfig(filePaths, buildTypeAwareConfig(), cwd, '타입 정보 규칙')
    : [];

  for (const result of [...baseResults, ...typeResults]) {
    const relPath = path.relative(cwd, result.filePath);
    const changedLines = diffMap.get(relPath);
    if (!changedLines) continue;

    for (const msg of result.messages) {
      if (msg.line === undefined || !changedLines.has(msg.line)) continue;

      findings.push({
        tool: 'eslint',
        ruleId: msg.ruleId ?? 'unknown',
        // 내장 규칙은 프로젝트 강제 설정이 아니므로 항상 WARNING(권장)으로 처리
        severity: 'WARNING',
        file: relPath,
        line: msg.line,
        col: msg.column,
        message: msg.message,
      });
    }
  }

  console.log(`[eslint/builtin] 완료 — ${findings.length}개 finding`);
  return findings;
}
