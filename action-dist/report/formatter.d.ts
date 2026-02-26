import type { AggregatedResult, Finding } from '../types.js';
/**
 * 기존 봇 코멘트를 식별하기 위한 HTML 마커.
 * 재실행 시 이 마커가 포함된 코멘트를 찾아 업데이트한다.
 */
export declare const BOT_MARKER = "<!-- pr-quality-action -->";
/**
 * AggregatedResult를 PR 요약 코멘트용 Markdown 문자열로 변환한다.
 *
 * 구성:
 *   1. BOT_MARKER (봇 코멘트 식별용)
 *   2. 제목: PR Quality Report
 *   3. Blocking / Warning 개수 요약
 *   4. Blocking 목록
 *   5. Warning 목록
 */
export declare function formatSummary(result: AggregatedResult): string;
/**
 * Blocking Finding을 PR 라인 코멘트 본문으로 변환한다.
 */
export declare function formatLineComment(f: Finding): string;
//# sourceMappingURL=formatter.d.ts.map