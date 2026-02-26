import type { DiffMap, Finding } from '../types';
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
export declare function runEslint(diffMap: DiffMap): Promise<Finding[]>;
//# sourceMappingURL=runner.d.ts.map