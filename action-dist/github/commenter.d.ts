import type { AggregatedResult } from '../types.js';
/**
 * PR에 요약 코멘트와 Blocking 라인 코멘트를 작성한다.
 *
 * @param result  - 집계된 검사 결과
 * @param token   - GitHub token (pull-requests: write 권한 필요)
 */
export declare function postComments(result: AggregatedResult, token: string): Promise<void>;
//# sourceMappingURL=commenter.d.ts.map