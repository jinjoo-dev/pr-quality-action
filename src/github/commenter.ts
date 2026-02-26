import { getOctokit, context } from '@actions/github';
import type { AggregatedResult, Finding } from '../types.js';
import { BOT_MARKER, formatSummary, formatLineComment } from '../report/formatter.js';

type Octokit = ReturnType<typeof getOctokit>;

/**
 * PR 라인 코멘트 중복을 방지하기 위해 기존 리뷰 코멘트를 조회한다.
 * file:line 조합을 키로 사용하여 이미 남긴 코멘트를 건너뛴다.
 */
async function getExistingReviewCommentKeys(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<Set<string>> {
  const { data: existingComments } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const keys = new Set<string>();
  for (const c of existingComments) {
    if (c.body.includes(BOT_MARKER) || c.user?.type === 'Bot') {
      keys.add(`${c.path}:${c.line ?? c.original_line}`);
    }
  }
  return keys;
}

/**
 * 요약 코멘트를 생성하거나, 이전 실행의 코멘트가 있으면 업데이트한다.
 * BOT_MARKER HTML 주석을 이용해 봇 코멘트를 식별한다.
 */
async function upsertSummaryComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(BOT_MARKER));

  if (existing) {
    console.log(`[commenter] 기존 요약 코멘트 업데이트 (id: ${existing.id})`);
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    console.log('[commenter] 새 요약 코멘트 생성');
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }
}

/**
 * Blocking Finding에 대해 PR 라인 코멘트를 생성한다.
 *
 * 동일 위치(file:line)에 이미 봇 코멘트가 있으면 건너뛴다.
 * GitHub API 요구사항:
 *   - line: 새 파일 기준 라인 번호
 *   - side: 'RIGHT' (새 파일 기준)
 *   - commit_id: PR head SHA
 */
async function postLineComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  blockingFindings: Finding[],
): Promise<void> {
  const existingKeys = await getExistingReviewCommentKeys(
    octokit,
    owner,
    repo,
    pullNumber,
  );

  for (const f of blockingFindings) {
    if (f.line == null) continue;

    const key = `${f.file}:${f.line}`;
    if (existingKeys.has(key)) {
      console.log(`[commenter] 라인 코멘트 중복 건너뜀: ${key}`);
      continue;
    }

    try {
      await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        path: f.file,
        line: f.line,
        side: 'RIGHT',
        body: `${BOT_MARKER}\n${formatLineComment(f)}`,
      });
      existingKeys.add(key); // 동일 실행 내 중복 방지
      console.log(`[commenter] 라인 코멘트 생성: ${key}`);
    } catch (err) {
      // diff 범위 밖이거나 파일이 삭제된 경우 API 오류가 발생할 수 있다
      console.warn(`[commenter] 라인 코멘트 생성 실패 (${key}):`, err);
    }
  }
}

/**
 * PR에 요약 코멘트와 Blocking 라인 코멘트를 작성한다.
 *
 * @param result     - 집계된 검사 결과
 * @param token      - GitHub token (pull-requests: write 권한 필요)
 * @param pullNumber - PR 번호. 미제공 시 pull_request 컨텍스트에서 읽음
 * @param commitId   - Head commit SHA. 미제공 시 pull_request 컨텍스트에서 읽음
 */
export async function postComments(
  result: AggregatedResult,
  token: string,
  pullNumber?: number,
  commitId?: string,
): Promise<void> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;
  const pr = context.payload.pull_request;

  const resolvedPullNumber = pullNumber ?? (pr?.number as number | undefined);
  const resolvedCommitId = commitId ?? (pr?.head as { sha: string } | undefined)?.sha;

  if (!resolvedPullNumber || !resolvedCommitId) {
    throw new Error('[commenter] PR 번호 또는 commit SHA를 확인할 수 없습니다. pullNumber/commitId 파라미터를 전달하거나 pull_request 이벤트에서 실행하세요.');
  }

  const pullNumber_ = resolvedPullNumber;
  const commitId_ = resolvedCommitId;

  // 1. 요약 코멘트 생성 또는 업데이트
  const summaryBody = formatSummary(result);
  await upsertSummaryComment(octokit, owner, repo, pullNumber_, summaryBody);

  // 2. Blocking 항목 라인 코멘트
  if (result.blocking.length > 0) {
    await postLineComments(
      octokit,
      owner,
      repo,
      pullNumber_,
      commitId_,
      result.blocking,
    );
  }
}
