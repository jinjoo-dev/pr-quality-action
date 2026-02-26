import type { AggregatedResult, Finding } from '../types';
/**
 * 여러 runner에서 수집한 Finding 배열을 통합한다.
 *
 * - 중복 제거: tool + file + line + ruleId 조합을 키로 사용
 * - 정렬: 파일 경로 → 라인 번호 오름차순
 * - 분류: BLOCKING / WARNING 분리
 */
export declare function aggregate(findings: Finding[]): AggregatedResult;
//# sourceMappingURL=aggregator.d.ts.map