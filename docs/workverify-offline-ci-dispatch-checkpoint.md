# WorkVerify Offline Security CI — checkpoint

## Changes
- Enabled manual workflow_dispatch alongside push and pull_request for .github/workflows/workverify-http-offline-tests.yml.
- Latest workflow commit: 16dd55706c121722996efe3045275b93038aecd6.
- Vercel reported commit status success, which only proves website deployment status, not Python test passage.

## Verification limits
- GitHub connector currently provides no workflow dispatch action and its commit-workflow-runs lookup only includes pull-request-triggered runs. No passing Actions run has been confirmed.
- Local container HTTP download failed due to DNS resolution, so it could not fetch repository contents for local execution.
- Synthetic concurrency acceptance remains untested over independent live HTTP connections. Never claim the test is passing from code review alone.

## Next authorized test
- Trigger 'WorkVerify security smoke unit checks' through GitHub Actions using workflow_dispatch.
- Confirm the suite exits zero and inspect failures before proceeding.
- Separately, an isolated JWT/fixture setup is required to execute real two-request concurrency tests.
- Keep employer-confirmation intake and real outreach off.
