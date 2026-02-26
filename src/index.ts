import * as core from '@actions/core';
import * as github from '@actions/github';
import { buildDiffMap } from './git/diff';
import { runTypecheck } from './typecheck/runner';
import { runEslint } from './eslint/runner';
import { aggregate } from './report/aggregator';
import { postComments } from './github/commenter';
import type { Runner } from './types';

/**
 * 전체 파이프라인을 오케스트레이션한다.
 *
 * 파이프라인:
 *   1. PR diff → DiffMap 빌드
 *   2. Runner들 병렬 실행 (typecheck, eslint, ...)
 *   3. Finding 집계 (중복제거 / 정렬 / 분류)
 *   4. PR 코멘트 작성
 *   5. Exit 정책: Blocking 존재 시 exit(1)
 *
 * 향후 runner 추가 시 runners 배열에만 추가하면 된다.
 *   예: secret scanner, AST rule engine, LLM reviewer
 */
async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  const pr = github.context.payload.pull_request;

  // pull_request 컨텍스트가 없으면 (e.g. issue_comment 이벤트) 입력값에서 폴백
  const base: string =
    (pr?.base as { sha: string } | undefined)?.sha ?? core.getInput('base-sha');
  const head: string =
    (pr?.head as { sha: string } | undefined)?.sha ?? core.getInput('head-sha');
  const prNumber: number =
    (pr?.number as number | undefined) ??
    (core.getInput('pr-number') ? parseInt(core.getInput('pr-number'), 10) : NaN);

  if (!base || !head) {
    core.setFailed(
      'pull_request 컨텍스트가 없습니다. base-sha와 head-sha 입력값을 제공해주세요.',
    );
    return;
  }

  if (isNaN(prNumber)) {
    core.setFailed(
      'pull_request 컨텍스트가 없습니다. pr-number 입력값을 제공해주세요.',
    );
    return;
  }

  core.info(`[run] diff 분석 시작: ${base}...${head}`);

  // ── Step 1: DiffMap 빌드 ────────────────────────────────────────────────
  const diffMap = buildDiffMap(base, head);
  const changedFileList = [...diffMap.keys()];

  if (changedFileList.length === 0) {
    core.info('[run] 변경된 JS/TS 파일이 없습니다. 검사를 건너뜁니다.');
    return;
  }

  core.info(`[run] 변경 파일 ${changedFileList.length}개: ${changedFileList.join(', ')}`);

  // ── Step 2: Runner들 병렬 실행 ──────────────────────────────────────────
  // 향후 runner를 추가할 때는 이 배열에만 추가하면 된다
  const runners: Runner[] = [runTypecheck, runEslint];

  const findingArrays = await Promise.all(
    runners.map((runner) =>
      runner(diffMap).catch((err: unknown) => {
        core.warning(`Runner 실행 오류: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }),
    ),
  );

  const allFindings = findingArrays.flat();

  // ── Step 3: 집계 ────────────────────────────────────────────────────────
  const result = aggregate(allFindings);

  core.info(
    `[run] 집계 완료 — Blocking: ${result.blocking.length}, Warning: ${result.warnings.length}`,
  );

  // ── Step 4: PR 코멘트 작성 ──────────────────────────────────────────────
  try {
    await postComments(result, token, prNumber, head);
  } catch (err) {
    core.warning(
      `[run] PR 코멘트 작성 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Step 5: Exit 정책 ───────────────────────────────────────────────────
  if (result.blocking.length > 0) {
    core.setFailed(
      `${result.blocking.length}개의 Blocking 항목이 발견되었습니다. PR을 병합하기 전에 수정해야 합니다.`,
    );
    process.exit(1);
  }

  core.info('[run] 검사 완료. Blocking 항목 없음.');
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
