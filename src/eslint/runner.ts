import { ESLint } from 'eslint';
import path from 'path';
import fs from 'fs';
import type { DiffMap, Finding } from '../types';

/**
 * 프로젝트 루트에서 ESLint 설정 파일 형식을 감지한다.
 *
 * ESLint 9는 flat config (eslint.config.*) 를 기본으로 사용한다.
 * flat config 파일이 없고 legacy (.eslintrc.*) 파일만 있으면
 * ESLINT_USE_FLAT_CONFIG=false 를 설정해 legacy 모드로 강제 전환한다.
 */
function detectAndApplyEslintConfigMode(cwd: string): 'flat' | 'legacy' | 'none' {
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

  const hasFlatConfig = flatConfigs.some((f) => fs.existsSync(path.join(cwd, f)));
  if (hasFlatConfig) {
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    return 'flat';
  }

  const hasLegacyConfig = legacyConfigs.some((f) => fs.existsSync(path.join(cwd, f)));
  if (hasLegacyConfig) {
    // ESLint 9에서 legacy .eslintrc.* 를 로드하려면 이 플래그가 필요
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    return 'legacy';
  }

  return 'none';
}

/**
 * ESLint Node API를 사용하여 변경된 파일만 lint를 실행한다.
 * 결과는 diff 기반 필터링을 거쳐, 변경된 라인에 해당하는 오류만 반환한다.
 *
 * severity 2 → BLOCKING
 * severity 1 → WARNING
 */
export async function runEslint(diffMap: DiffMap): Promise<Finding[]> {
  const findings: Finding[] = [];
  const filePaths = [...diffMap.keys()];

  if (filePaths.length === 0) return findings;

  const cwd = process.cwd();
  const configMode = detectAndApplyEslintConfigMode(cwd);

  if (configMode === 'none') {
    console.log('[eslint] ESLint 설정 파일을 찾지 못했습니다. 검사를 건너뜁니다.');
    return findings;
  }

  console.log(`[eslint] 설정 모드: ${configMode}`);

  let eslint: ESLint;
  try {
    eslint = new ESLint({ errorOnUnmatchedPattern: false, cwd });
  } catch (err) {
    console.warn(
      `[eslint] ESLint 인스턴스 생성 실패 (설정 파일 오류일 수 있음): ${err instanceof Error ? err.message : String(err)}`,
    );
    return findings;
  }

  // ESLint ignore 설정에 해당하는 파일 제거
  const lintableFiles: string[] = [];
  for (const file of filePaths) {
    try {
      const ignored = await eslint.isPathIgnored(file);
      if (!ignored) lintableFiles.push(file);
    } catch {
      lintableFiles.push(file);
    }
  }

  if (lintableFiles.length === 0) {
    console.log('[eslint] 검사할 파일 없음 (모두 ignore)');
    return findings;
  }

  console.log(`[eslint] ${lintableFiles.length}개 파일 검사 중...`);

  let results: ESLint.LintResult[];
  try {
    results = await eslint.lintFiles(lintableFiles);
  } catch (err) {
    console.warn(
      `[eslint] lintFiles 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
    return findings;
  }

  for (const result of results) {
    const relPath = path.relative(cwd, result.filePath);
    const changedLines = diffMap.get(relPath);

    if (!changedLines) continue;

    for (const msg of result.messages) {
      if (msg.line === undefined || !changedLines.has(msg.line)) continue;

      const severity = msg.severity === 2 ? 'BLOCKING' : 'WARNING';

      findings.push({
        tool: 'eslint',
        ruleId: msg.ruleId ?? 'unknown',
        severity,
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
