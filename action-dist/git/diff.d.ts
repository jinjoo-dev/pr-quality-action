import type { DiffMap } from '../types.js';
/**
 * git diff --name-only 를 실행하여 변경된 JS/TS 파일 목록을 반환한다.
 * node_modules / dist / build 디렉토리는 제외한다.
 */
export declare function getChangedFiles(base: string, head: string): string[];
/**
 * unified diff를 파싱하여 DiffMap을 빌드한다.
 *
 * DiffMap: { filePath → Set<새 파일 기준 변경 라인 번호 (1-indexed)> }
 *
 * 알고리즘:
 *  - "+++ b/<path>" 로 현재 파일 전환
 *  - "@@ -a,b +c,d @@" 헤더에서 newLineNum = c 로 초기화
 *  - "+" 시작 라인: changedLines에 추가 후 newLineNum++
 *  - "-" 시작 라인: 새 파일에 없으므로 newLineNum 유지
 *  - " " 시작 (context): newLineNum만 증가
 *  - rename / binary / CRLF / multiple hunks 모두 처리
 */
export declare function buildDiffMap(base: string, head: string): DiffMap;
//# sourceMappingURL=diff.d.ts.map