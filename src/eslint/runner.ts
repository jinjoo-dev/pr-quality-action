import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { DiffMap, Finding } from '../types';

/** ESLint JSON 포맷 출력 타입 */
interface EslintJsonResult {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line: number;
    column: number;
  }>;
}

/**
 * 프로젝트 루트에서 ESLint 설정 파일 형식을 감지한다.
 *
 * flat config 없이 legacy .eslintrc.* 만 있으면 'legacy' 반환.
 * 서브프로세스 실행 시 ESLINT_USE_FLAT_CONFIG=false 환경변수로 전달해야 한다.
 */
function detectConfigMode(cwd: string): 'flat' | 'legacy' | 'none' {
  const flatConfigs = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
  ];
  const legacyConfigs = [
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.mjs',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc',
  ];

  if (flatConfigs.some((f) => fs.existsSync(path.join(cwd, f)))) return 'flat';
  if (legacyConfigs.some((f) => fs.existsSync(path.join(cwd, f)))) return 'legacy';
  return 'none';
}

/**
 * 프로젝트에 설치된 ESLint 바이너리를 서브프로세스로 실행한다.
 *
 * 번들된 ESLint Node API 대신 서브프로세스를 사용하는 이유:
 *   ncc CJS 번들 환경에서 ESLint가 eslint.config.mjs 등을 동적 import() 할 때
 *   `?mtime=...` 캐시버스팅 URL 처리에 실패하는 문제가 있다.
 *   프로젝트 자체 바이너리를 쓰면 ESLint가 자신의 Node.js 컨텍스트에서
 *   설정을 로드하므로 이 문제가 발생하지 않는다.
 *
 * ESLint exit code:
 *   0 → 오류 없음
 *   1 → lint 오류 발견 (stdout에 JSON 있음)
 *   2 → fatal 오류 (설정 파일 파싱 실패 등)
 */
export async function runEslint(diffMap: DiffMap): Promise<Finding[]> {
  const findings: Finding[] = [];
  const filePaths = [...diffMap.keys()];

  if (filePaths.length === 0) return findings;

  const cwd = process.cwd();

  const eslintBin = path.join(cwd, 'node_modules', '.bin', 'eslint');
  if (!fs.existsSync(eslintBin)) {
    console.log('[eslint] node_modules/.bin/eslint를 찾을 수 없습니다. 검사를 건너뜁니다.');
    return findings;
  }

  const configMode = detectConfigMode(cwd);
  if (configMode === 'none') {
    console.log('[eslint] ESLint 설정 파일을 찾지 못했습니다. 검사를 건너뜁니다.');
    return findings;
  }

  console.log(`[eslint] 설정 모드: ${configMode}, 파일 ${filePaths.length}개 검사 중...`);

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (configMode === 'legacy') {
    env.ESLINT_USE_FLAT_CONFIG = 'false';
  }

  const result = spawnSync(
    eslintBin,
    ['--format', 'json', '--no-error-on-unmatched-pattern', ...filePaths],
    { cwd, encoding: 'utf-8', env, maxBuffer: 10 * 1024 * 1024 },
  );

  if (result.error || result.status === 2) {
    console.warn(
      `[eslint] ESLint 실행 실패 (exit ${result.status ?? 'error'}): ${result.error?.message ?? result.stderr?.slice(0, 300) ?? ''}`,
    );
    return findings;
  }

  let lintResults: EslintJsonResult[];
  try {
    lintResults = JSON.parse(result.stdout) as EslintJsonResult[];
  } catch {
    console.warn(`[eslint] JSON 파싱 실패 — stdout: ${result.stdout.slice(0, 200)}`);
    return findings;
  }

  for (const fileResult of lintResults) {
    const relPath = path.relative(cwd, fileResult.filePath);
    const changedLines = diffMap.get(relPath);

    if (!changedLines) continue;

    for (const msg of fileResult.messages) {
      if (!changedLines.has(msg.line)) continue;

      findings.push({
        tool: 'eslint',
        ruleId: msg.ruleId ?? 'unknown',
        severity: msg.severity === 2 ? 'BLOCKING' : 'WARNING',
        file: relPath,
        line: msg.line,
        col: msg.column,
        message: msg.message,
      });
    }
  }

  console.log(`[eslint] 완료 — ${findings.length}개 finding`);
  return findings;
}
