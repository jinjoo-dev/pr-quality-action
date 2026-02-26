import type { DiffMap, Finding } from '../types';
/**
 * ESLint Node API를 사용하여 변경된 파일만 lint를 실행한다.
 * 결과는 diff 기반 필터링을 거쳐, 변경된 라인에 해당하는 오류만 반환한다.
 *
 * severity 2 → BLOCKING
 * severity 1 → WARNING
 */
export declare function runEslint(diffMap: DiffMap): Promise<Finding[]>;
//# sourceMappingURL=runner.d.ts.map