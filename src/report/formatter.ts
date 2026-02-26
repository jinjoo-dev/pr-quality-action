import type { AggregatedResult, Finding } from '../types';

/**
 * 기존 봇 코멘트를 식별하기 위한 HTML 마커.
 * 재실행 시 이 마커가 포함된 코멘트를 찾아 업데이트한다.
 */
export const BOT_MARKER = '<!-- pr-quality-action -->';

/**
 * 요약 코멘트 렌더링용 그룹.
 * 같은 파일·같은 규칙의 연속 라인들을 묶어 한 줄로 표시한다.
 */
interface FindingGroup {
  tool: string;
  ruleId: string;
  file: string;
  startLine?: number;
  endLine?: number;
  count: number;
  message: string;
  note?: string;
}

/**
 * 정렬된 Finding[]을 연속 라인 그룹으로 묶는다.
 *
 * 그룹 조건: 같은 파일 + 같은 ruleId + 라인 간격 ≤ 2
 * (간격을 1이 아닌 2로 허용하면 인접한 블록도 자연스럽게 묶임)
 */
function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups: FindingGroup[] = [];

  for (const f of findings) {
    const last = groups[groups.length - 1];
    const isConsecutive =
      last !== undefined &&
      last.file === f.file &&
      last.ruleId === f.ruleId &&
      last.tool === f.tool &&
      f.line != null &&
      last.endLine != null &&
      f.line - last.endLine <= 2;

    if (isConsecutive && last !== undefined) {
      last.endLine = f.line;
      last.count += 1;
    } else {
      groups.push({
        tool: f.tool,
        ruleId: f.ruleId,
        file: f.file,
        startLine: f.line,
        endLine: f.line,
        count: 1,
        message: f.message,
        note: f.note,
      });
    }
  }

  return groups;
}

/** FindingGroup을 Markdown 목록 항목으로 변환 */
function groupLine(g: FindingGroup): string {
  let loc = '';
  if (g.startLine != null) {
    loc = g.startLine === g.endLine
      ? `:${g.startLine}`
      : `:${g.startLine}-${g.endLine}`;
  }
  const countNote = g.count > 1 ? ` _(${g.count}건)_` : '';
  const note = g.note ? `\n  > ${g.note}` : '';
  return `- \`${g.file}${loc}\` **[${g.tool}/${g.ruleId}]** ${g.message}${countNote}${note}`;
}

/** 각 Finding을 Markdown 목록 항목으로 변환 (라인 코멘트용, 그룹화 없음) */
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
    const blockingGroups = groupFindings(blocking);
    lines.push('### Blocking');
    lines.push('');
    for (const g of blockingGroups) {
      lines.push(groupLine(g));
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    const warningGroups = groupFindings(warnings);
    lines.push('<details>');
    lines.push(`<summary>Warning (${warnings.length}건 — 클릭하여 펼치기)</summary>`);
    lines.push('');
    for (const g of warningGroups) {
      lines.push(groupLine(g));
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
