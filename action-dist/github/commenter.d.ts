import type { AggregatedResult } from '../types';
/**
 * PR에 요약 코멘트와 Blocking 라인 코멘트를 작성한다.
 *
 * @param result     - 집계된 검사 결과
 * @param token      - GitHub token (pull-requests: write 권한 필요)
 * @param pullNumber - PR 번호. 미제공 시 pull_request 컨텍스트에서 읽음
 * @param commitId   - Head commit SHA. 미제공 시 pull_request 컨텍스트에서 읽음
 */
export declare function postComments(result: AggregatedResult, token: string, pullNumber?: number, commitId?: string): Promise<void>;
//# sourceMappingURL=commenter.d.ts.map