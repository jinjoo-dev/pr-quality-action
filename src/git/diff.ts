import { execSync } from 'child_process';
import type { DiffMap } from '../types';

/** unified diff hunk 헤더: @@ -a,b +c,d @@ — 새 파일 시작 라인(c) 캡처 */
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** 검사 대상 확장자 */
const TS_FILE_RE = /\.(ts|tsx|js|jsx)$/;

/** 제외 디렉토리 접두사 */
const EXCLUDED_DIRS_RE = /^(node_modules|dist|build)\//;

/**
 * git diff --name-only 를 실행하여 변경된 JS/TS 파일 목록을 반환한다.
 * node_modules / dist / build 디렉토리는 제외한다.
 */
export function getChangedFiles(base: string, head: string): string[] {
  const output = execSync(`git diff --name-only ${base}...${head}`, {
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f && TS_FILE_RE.test(f) && !EXCLUDED_DIRS_RE.test(f));
}

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
export function buildDiffMap(base: string, head: string): DiffMap {
  const raw = execSync(`git diff -U0 ${base}...${head}`, {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024, // 100MB
  });

  // Windows CRLF 정규화
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const diffMap: DiffMap = new Map();

  let currentFile: string | null = null;
  let isBinary = false;
  let newLineNum = 0;

  for (const line of lines) {
    // ── 파일 헤더 파싱 ──────────────────────────────────────────────────────
    // "+++ b/<path>" — 새 파일 경로 확정 (rename 포함)
    if (line.startsWith('+++ b/')) {
      const filePath = line.slice(6);
      isBinary = false;
      if (TS_FILE_RE.test(filePath) && !EXCLUDED_DIRS_RE.test(filePath)) {
        currentFile = filePath;
        if (!diffMap.has(currentFile)) {
          diffMap.set(currentFile, new Set());
        }
      } else {
        currentFile = null;
      }
      continue;
    }

    // "--- a/<path>" — 이전 파일 경로 (rename 감지 시 무시, +++ 에서만 처리)
    if (line.startsWith('--- ')) {
      continue;
    }

    // binary 파일 감지
    if (line.startsWith('Binary files')) {
      isBinary = true;
      currentFile = null;
      continue;
    }

    // 새 diff 블록 시작 → 상태 초기화
    if (line.startsWith('diff --git')) {
      isBinary = false;
      currentFile = null;
      continue;
    }

    if (!currentFile || isBinary) continue;

    // ── hunk 헤더 ──────────────────────────────────────────────────────────
    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      newLineNum = parseInt(hunkMatch[1], 10);
      continue;
    }

    // ── hunk 본문 ──────────────────────────────────────────────────────────
    const set = diffMap.get(currentFile)!;

    if (line.startsWith('+')) {
      // 추가 라인: 변경 라인으로 기록
      set.add(newLineNum);
      newLineNum++;
    } else if (line.startsWith('-')) {
      // 삭제 라인: 새 파일에는 존재하지 않으므로 번호 증가 없음
    } else if (line.startsWith(' ')) {
      // context 라인: 번호만 증가
      newLineNum++;
    }
    // "\\ No newline at end of file" 등은 무시
  }

  return diffMap;
}
