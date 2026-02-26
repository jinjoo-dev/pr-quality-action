import type { AggregatedResult, Finding } from '../types';

/**
 * 기존 봇 코멘트를 식별하기 위한 HTML 마커.
 * 재실행 시 이 마커가 포함된 코멘트를 찾아 업데이트한다.
 */
export const BOT_MARKER = '<!-- pr-quality-action -->';

/** 각 Finding을 Markdown 목록 항목으로 변환 */
function findingLine(f: Finding): string {
  const loc = f.line != null ? `:${f.line}${f.col != null ? `:${f.col}` : ''}` : '';
  const note = f.note ? `\n  > ${f.note}` : '';
  return `- \`${f.file}${loc}\` **[${f.tool}/${f.ruleId}]** ${f.message}${note}`;
}

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
export function formatSummary(result: AggregatedResult): string {
  const { blocking, warnings } = result;

  const statusIcon = blocking.length > 0 ? '🔴' : warnings.length > 0 ? '🟡' : '🟢';
  const lines: string[] = [
    BOT_MARKER,
    `## ${statusIcon} PR Quality Report`,
    '',
    `| 구분 | 건수 |`,
    `|------|------|`,
    `| Blocking | **${blocking.length}** |`,
    `| Warning  | ${warnings.length} |`,
    '',
  ];

  if (blocking.length > 0) {
    lines.push('### Blocking');
    lines.push('');
    for (const f of blocking) {
      lines.push(findingLine(f));
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>Warning (${warnings.length}건 — 클릭하여 펼치기)</summary>`);
    lines.push('');
    for (const f of warnings) {
      lines.push(findingLine(f));
    }
    lines.push('');
    lines.push('</details>');
  }

  if (blocking.length === 0 && warnings.length === 0) {
    lines.push('변경된 파일에서 문제를 발견하지 못했습니다.');
  }

  return lines.join('\n');
}

/**
 * Blocking Finding을 PR 라인 코멘트 본문으로 변환한다.
 */
export function formatLineComment(f: Finding): string {
  const note = f.note ? `\n\n> ${f.note}` : '';
  return `**[${f.tool}/${f.ruleId}]** ${f.message}${note}`;
}
