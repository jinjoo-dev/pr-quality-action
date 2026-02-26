import type { AggregatedResult, Finding } from '../types.js';

/**
 * 여러 runner에서 수집한 Finding 배열을 통합한다.
 *
 * - 중복 제거: tool + file + line + ruleId 조합을 키로 사용
 * - 정렬: 파일 경로 → 라인 번호 오름차순
 * - 분류: BLOCKING / WARNING 분리
 */
export function aggregate(findings: Finding[]): AggregatedResult {
  // 중복 제거
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.tool}:${f.file}:${f.line ?? 'no-line'}:${f.ruleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 파일 경로 → 라인 번호 → tool 순으로 정렬
  unique.sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) return fileCmp;
    const lineCmp = (a.line ?? 0) - (b.line ?? 0);
    if (lineCmp !== 0) return lineCmp;
    return a.tool.localeCompare(b.tool);
  });

  return {
    blocking: unique.filter((f) => f.severity === 'BLOCKING'),
    warnings: unique.filter((f) => f.severity === 'WARNING'),
    all: unique,
  };
}
