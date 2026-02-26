import { ESLint } from 'eslint';
import path from 'path';
import type { DiffMap, Finding } from '../types';

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

  // ESLint 인스턴스 생성
  // 프로젝트에 eslint.config.js / .eslintrc 등이 있으면 자동으로 사용된다
  const eslint = new ESLint({
    // ignore 패턴도 프로젝트 설정을 그대로 사용
    errorOnUnmatchedPattern: false,
  });

  // 이미 ESLint ignore 설정에 해당하는 파일 제거
  const lintableFiles: string[] = [];
  for (const file of filePaths) {
    const ignored = await eslint.isPathIgnored(file);
    if (!ignored) lintableFiles.push(file);
  }

  if (lintableFiles.length === 0) {
    console.log('[eslint] 검사할 파일 없음 (모두 ignore)');
    return findings;
  }

  console.log(`[eslint] ${lintableFiles.length}개 파일 검사 중...`);
  const results = await eslint.lintFiles(lintableFiles);

  for (const result of results) {
    // ESLint가 반환하는 절대 경로를 repo 기준 상대 경로로 변환
    const relPath = path.relative(process.cwd(), result.filePath);
    const changedLines = diffMap.get(relPath);

    if (!changedLines) continue;

    for (const msg of result.messages) {
      // diff 기반 필터링: 변경된 라인에 포함된 오류만 수집
      if (msg.line === undefined || !changedLines.has(msg.line)) continue;

      // severity: 2 = error(BLOCKING), 1 = warn(WARNING)
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

  return findings;
}
