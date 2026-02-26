import ts from 'typescript';
import path from 'path';
import { glob } from 'glob';
import type { DiffMap, Finding } from '../types';

/**
 * deps 미설치 / lib 미설정으로 발생하는 환경 노이즈 진단을 판별한다.
 *
 * 필터링 대상:
 *   TS2307 (non-relative) — Cannot find module 'react' 등 외부 패키지 미설치
 *   TS7026              — JSX IntrinsicElements 없음 (@types/react 미설치)
 */
function isEnvironmentNoise(diag: ts.Diagnostic): boolean {
  // TS2307: "Cannot find module 'X'" — 로컬 상대 경로('./', '../')는 실제 오류이므로 유지
  if (diag.code === 2307) {
    const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    return /Cannot find module '(?!\.\.?\/)[^']+'/u.test(msg);
  }

  // TS7026: JSX element implicitly has type 'any' — @types/react 미설치 환경 노이즈
  if (diag.code === 7026) return true;

  return false;
}

/**
 * pnpm monorepo 환경을 고려하여 workspace별 tsconfig.json을 모두 탐색한다.
 * 각 tsconfig 영역에 변경된 파일이 포함된 경우에만 타입체크를 실행한다.
 */
export async function runTypecheck(diffMap: DiffMap): Promise<Finding[]> {
  const findings: Finding[] = [];
  const changedFiles = [...diffMap.keys()].map((f) => path.resolve(f));

  if (changedFiles.length === 0) return findings;

  // workspace 전체에서 tsconfig.json 탐색 (node_modules, dist 제외)
  const tsconfigs = await glob('**/tsconfig.json', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/action-dist/**'],
    absolute: true,
  });

  if (tsconfigs.length === 0) {
    console.warn('[typecheck] tsconfig.json을 찾지 못했습니다. 타입체크를 건너뜁니다.');
    return findings;
  }

  for (const tsconfigPath of tsconfigs) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      console.warn(`[typecheck] tsconfig 읽기 실패: ${tsconfigPath}`);
      continue;
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath),
    );

    if (parsed.errors.length > 0) {
      console.warn(`[typecheck] tsconfig 파싱 오류: ${tsconfigPath}`);
      continue;
    }

    // 이 tsconfig 영역에 변경 파일이 포함되어 있는지 확인
    const tsconfigDir = path.dirname(tsconfigPath);
    const relevantChanged = changedFiles.filter((absFile) => {
      // tsconfig의 rootDir 하위에 있거나 fileNames에 포함된 경우
      return (
        absFile.startsWith(tsconfigDir) &&
        parsed.fileNames.some(
          (fn) => path.resolve(fn) === absFile,
        )
      );
    });

    if (relevantChanged.length === 0) continue;

    console.log(
      `[typecheck] ${tsconfigPath} — 변경 파일 ${relevantChanged.length}개 포함`,
    );

    // skipLibCheck 강제 활성화: 외부 라이브러리 .d.ts 오류 무시
    //
    // lib 처리 전략:
    //   - parsed.options.lib === undefined → tsconfig에서 lib를 명시하지 않은 것.
    //     TypeScript가 target 기반 기본 lib를 사용하도록 undefined 그대로 유지.
    //     (임의로 덮어쓰면 ES 기본 타입이 모두 사라져 대규모 오탐이 발생함)
    //   - parsed.options.lib !== undefined → 명시된 lib에 DOM 계열이 없으면 보완.
    //     fetch / document 등 DOM 글로벌 미설정 환경 노이즈 방지.
    const DOM_LIBS = ['lib.dom.d.ts', 'lib.dom.iterable.d.ts'];
    const patchedLib =
      parsed.options.lib !== undefined
        ? [...new Set([...parsed.options.lib, ...DOM_LIBS])]
        : undefined;

    const programOptions: ts.CompilerOptions = {
      ...parsed.options,
      skipLibCheck: true,
      ...(patchedLib !== undefined && { lib: patchedLib }),
    };

    const program = ts.createProgram(parsed.fileNames, programOptions);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    for (const diag of diagnostics) {
      if (!diag.file) continue;

      // 환경 미설치로 인한 노이즈 필터링 (실제 코드 로직 오류가 아님)
      if (isEnvironmentNoise(diag)) continue;

      const absFile = diag.file.fileName;
      const relPath = path.relative(process.cwd(), absFile);

      // diff 대상 파일에 포함된 오류만 수집 (정규화된 경로 비교)
      if (!diffMap.has(relPath)) continue;

      const startPos = diag.start ?? 0;
      const { line, character } =
        diag.file.getLineAndCharacterOfPosition(startPos);
      const lineNum = line + 1; // 1-indexed

      findings.push({
        tool: 'typecheck',
        ruleId: `TS${diag.code}`,
        severity:
          diag.category === ts.DiagnosticCategory.Error
            ? 'BLOCKING'
            : 'WARNING',
        file: relPath,
        line: lineNum,
        col: character + 1,
        message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
      });
    }
  }

  return findings;
}
