import type { DiffMap, Finding } from '../types.js';
/**
 * pnpm monorepo 환경을 고려하여 workspace별 tsconfig.json을 모두 탐색한다.
 * 각 tsconfig 영역에 변경된 파일이 포함된 경우에만 타입체크를 실행한다.
 */
export declare function runTypecheck(diffMap: DiffMap): Promise<Finding[]>;
//# sourceMappingURL=runner.d.ts.map