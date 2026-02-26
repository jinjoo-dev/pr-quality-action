export type Severity = 'BLOCKING' | 'WARNING';

export type Tool = 'typecheck' | 'eslint';

export interface Finding {
  /** 어떤 도구에서 발견했는지 */
  tool: Tool;
  /** 규칙 ID (예: TS2345, no-unused-vars) */
  ruleId: string;
  /** 심각도 */
  severity: Severity;
  /** repo root 기준 상대 경로 */
  file: string;
  /** 새 파일 기준 라인 번호 (1-indexed) */
  line?: number;
  /** 컬럼 번호 (1-indexed) */
  col?: number;
  /** 오류 메시지 */
  message: string;
  /** LLM 2차 리뷰 등 향후 보강 메시지를 위한 확장 필드 */
  note?: string;
}

/**
 * key: repo root 기준 파일 상대 경로
 * value: 새 파일 기준으로 변경된 라인 번호 집합 (1-indexed)
 */
export type DiffMap = Map<string, Set<number>>;

export interface AggregatedResult {
  blocking: Finding[];
  warnings: Finding[];
  all: Finding[];
}

/**
 * 향후 runner 확장 시 공통 인터페이스로 사용 가능
 * secret scanner, AST rule engine, LLM reviewer 등이 이 시그니처를 따른다
 */
export type Runner = (diffMap: DiffMap) => Promise<Finding[]>;
