# Validation status — 2026-10-27

The gateway is deployed. The user confirmed real GitHub authorization, successful ChatGPT tool refresh, and an actual intervals.icu data query. Production account/athlete settings, origin, resource IDs, and deployment version identifiers are intentionally not included in this public report.

## Verified

- Official pinned cf CLI and compatible beta Vite plugin; Node from .node-version.
- Type checks and OAuth integration tests using the real provider in Miniflare/workerd.
- Chromium submissions of both consent approval and cancellation, including CSP/referrer behavior, with external destinations intercepted locally.
- Numeric owner, S256 PKCE, exact callback/audience, consent cookie binding, scope/version invalidation, refresh/revocation, replay rejection, credential stripping, and standard MCP metadata forwarding.
- Native container startup/readiness, concurrent startup sharing, pinned image selection, inactivity timeout restoration, old-image replacement, and no replay of interrupted calls.
- Full image from pinned ICU Visor source plus the reviewed one-line stateless HTTP patch, using Go 1.26.10 with TLS verification enabled.
- Real-container smoke with a dummy key: current server/discover advertises 2026-07-28; current tools/list and legacy initialize/initialized/tools-list return the same **22 read-only tools**. No intervals.icu API calls are made by this smoke test; no MCP session ID is issued.
- Full cf build, prebuilt production dry run, and live deployment completion. Authenticated Cloudflare metadata confirms the selected account, Worker deployment, container application, and both runtime bindings as Secret types; values were not read back.
- Temporary diagnostic code/configuration was removed from source and redeployed. Remaining fixed diagnostic KV records were deleted without enumerating or deleting OAuth records. No public diagnostics endpoint exists.
- The user confirmed real owner OAuth, tool refresh, and successful data use in ChatGPT. This confirms more than local tests or deployment completion alone.

Final wrap-up checks pass: **24 tests**, including four private-settings selection/privacy tests, TypeScript, the public-template CI build/dry run, the private deployment build/dry run, and the real-container smoke. The public-template/tracked-file guard passes. See GitHub CI for verification of the final main revision.

## Still separate / outstanding

- **Real non-owner browser acceptance:** automated tests deny a stub identity, but a fresh real connection with another GitHub account still needs to be observed. Follow docs/OPERATIONS.md. No production authorization should be loosened to facilitate this check.
- **Executor public smoke:** this managed environment's enforced proxy policy did not include the public Worker hostname. Its CONNECT 403 prevented npm run smoke here. Real user OAuth/data access succeeded independently. No network bypass was attempted.
- **Manual production GitHub Actions setup:** the workflow exists but requires the documented production environment secrets before it can deploy. A successful authenticated local deployment does not establish that CI credentials/reviewer rules are configured.
- **History/caches:** the owner authorized rewriting reachable history to replace known non-secret deployment identifiers and the personal author email. Both the rewritten history and final tree pass the release audit. Existing external clones and hosting caches are outside the guarantee of a Git ref rewrite.

## Public-repository audit

Runtime secrets were stored as Cloudflare Secret entries, not in source or image layers. Local CLI/Docker credentials stayed under ignored work/ and were never archived or committed. The Docker context admits only the Dockerfile and the reviewed transport patch; the upstream build fetches its own source.

Gitleaks 8.30.1 was downloaded with its published SHA-256 checksum verified. A redacted scan of all implementation history found **zero detected secrets** before final handoff edits. A separate scan of the final publishable tree found **zero detected secrets**, and a manual search found no configured deployment identifiers or email-like strings in publishable files. After the authorized rewrite, a fresh redacted history scan also found zero detected secrets. Manual inspection of every reachable blob found no known deployment identifiers; all commit author/committer emails use the expected GitHub noreply address. Manual checks also cover tracked private-file names, known deployment identifiers, credential patterns, and absent runtime debug statements. Test credentials are dummy values only; no health-data responses are saved in tests or docs.

For the causes and retained fixes behind deployment/browser/protocol failures, read [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Private local execution helpers may not survive a new environment; reproduce them from the runtime skill and deployment guide instead of assuming they exist.

The live Worker audit confirms both credentials are Secret bindings, the deployed configuration matches private settings, read-only mode is active, the diagnostic binding is absent, and retrieved deployed source contains none of the temporary diagnostic markers. No secret values were retrieved.

Documentation links and workflow YAML were checked. The production settings restoration step was executed with a dummy fixture to verify valid JSON output and multiline-value masking, without using production secrets. The unused container-helper dependency was removed; the native Container API is the deployed lifecycle implementation.
