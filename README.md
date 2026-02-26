# pr-quality-action

> **This project is being developed through vibe coding with Claude Sonnet 4.6.**

PR diff 기반으로 TypeScript 타입체크 및 ESLint를 실행하고 결과를 PR 코멘트로 남기는 GitHub Custom Action.

## 사용법

```yaml
- name: Run PR Quality Check
  uses: jinjoo-dev/pr-quality-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    # pull_request 이벤트가 아닌 경우 (예: issue_comment) 아래 값을 직접 전달
    base-sha: ${{ steps.pr.outputs.base_sha }}
    head-sha: ${{ steps.pr.outputs.head_sha }}
    pr-number: ${{ github.event.issue.number }}
```

## Inputs

| 이름 | 필수 | 설명 |
|------|------|------|
| `github-token` | ✅ | PR 코멘트 작성용 토큰 (`pull-requests: write` 권한 필요) |
| `base-sha` | | Base commit SHA (`issue_comment` 이벤트 등에서 필요) |
| `head-sha` | | Head commit SHA (`issue_comment` 이벤트 등에서 필요) |
| `pr-number` | | PR 번호 (`issue_comment` 이벤트 등에서 필요) |

## Outputs

| 이름 | 설명 |
|------|------|
| `blocking-count` | 발견된 Blocking 항목 수 |
| `warning-count` | 발견된 Warning 항목 수 |

## 빌드

```bash
npm install
npm run bundle
```

## 배포

```bash
git add -A && git commit -m "..."
git tag -fa v1 -m "v1"
git push origin main
git push origin v1 --force
```

