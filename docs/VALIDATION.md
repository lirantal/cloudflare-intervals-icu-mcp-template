# Validation status — 2026-10-27

The full MCP Worker and container image are **deployed** to the authorized example-account account. Real GitHub OAuth sign-in through ChatGPT has succeeded. ChatGPT tool refresh has completed without an error and the live probe captured server/discover followed by tools/list. A real intervals.icu data query, executor public smoke test, and real non-owner rejection are **not yet verified**.

## Production state

- Account: example-account, `REPLACE`; confirmed through authenticated Cloudflare API calls.
- The user enabled Workers Paid after reviewing base and metered costs. The subscriptions API confirms `workers_paid` in state `Paid`. The implementation did not change billing.
- Public origin: `https://icuvisor-mcp.example.workers.dev`.
- Worker version: `REDACTED_DEPLOYMENT_VERSION`, confirmed at 100% in the deployments API.
- Container image uploaded and prepared successfully: `sha256:2c43079e483301d6a2639f0591923761dbe9d4d2d112397a27e9dc6a0eaefc8b` (pinned source plus stateless transport patch).
- OAuth KV namespace provisioned: `REDACTED_RESOURCE_ID`.
- SQLite Durable Object namespace: `REDACTED_RESOURCE_ID`.
- Both `GITHUB_CLIENT_SECRET` and `INTERVALS_ICU_API_KEY` were entered in the dashboard. Metadata-only checks after full deployment confirm both remain `secret_text`. Their values were not printed or saved locally.
- Sole owner: GitHub `lirantal`, numeric ID `REPLACE`.
- Non-secret settings are saved in `deployment.json`, including the supplied OAuth App client ID and athlete ID. Production preflight passes.

## Local verification completed

- Node 24.22.0 and official `cf` 1.0.0-beta.23; dependencies installed with `npm ci`.
- `npm run check` passes.
- `npm test` passes: **20 tests**. Seventeen use real OAuth provider code in Miniflare/workerd with stub GitHub/container endpoints. Two of those sixteen drive the rendered consent page in Chromium through a loopback bridge to the real workerd fixture, intercepting GitHub/ChatGPT requests before network access. Three other tests cover native container lifecycle behavior with mocked runtime APIs.
- OAuth coverage includes discovery, issuer identification, DCR callback restrictions, anonymous/forged bearer rejection, S256 PKCE, canonical audience, consent cancellation/browser binding, non-owner denial, owner authorization, credential stripping, session headers, Origin rejection, refresh/revocation, code replay, and authorization-version/scope policy.
- Lifecycle coverage includes shared startup for concurrent requests, pinned image/lite instance selection, read-only runtime settings, native inactivity timeout restoration, replacement of an old image, and no replay of interrupted MCP calls.
- Docker builds the pinned icuvisor commit `069f893e91819a454da80015df8f2ae6158707ae` using Go 1.26.10. Local Linux amd64 image: `sha256:6c950978f33eae9ab2674e71df89b1e1c0f7a89ef95ff2fe21345e06e16c2356`.
- Real-container Streamable HTTP smoke test passes: initialize, initialized notification, and tools/list return **22 read-only tools**, using only a dummy API key. No intervals.icu API calls were made by that test.
- Full `cf build` and prebuilt production deployment dry run pass after the scheduling-policy changes.

## Deployment failures resolved

1. The old Go dependency download blocker is resolved. Current enforced policy includes `storage.googleapis.com` and required GitHub/package-manager/Cloudflare hosts. TLS verification remained enabled throughout.
2. Docker registry login initially attempted to write under the read-only home directory. An ignored mode-0700 `work/docker-client` directory contains an opaque copy of the existing Docker client configuration (mode 0600), preserving inherited proxy/registry settings. Command-scoped `DOCKER_CONFIG` points there for deployment; the original configuration is unchanged. Registry credentials are never printed or committed.
3. This account rejects the legacy/default container scheduling policy. Configuration now uses `schedulingPolicy: 'durable-object'`, a named `server` image, and the native Durable Object Container API for startup/readiness/inactivity. `instance: 'lite'` is selected at runtime. This policy has no `max_instances` setting: the Worker routes all authorized requests to the single fixed `owner` Durable Object. This is an application routing constraint, not a platform-wide spending cap.
4. The pinned beta CLI emits `script_name` for same-Worker bindings, then rejects it during validation for the new container policy. `cloudflare.config.ts` uses the supported unsafe-metadata escape hatch to emit the local `durable_object_namespace` binding with `class_name` only. The deployed binding metadata confirms a real Durable Object namespace binding. Local `npm run dev` may require an unsafe-binding simulation plugin; the explicitly bound Miniflare test fixture is verified.

Cloudflare scheduling references: [policy](https://developers.cloudflare.com/containers/configuration/scheduling-policy/) and [native API](https://developers.cloudflare.com/containers/api/durable-object-container/).

## Outstanding acceptance

- The managed executor's public smoke command fails before reaching the Worker: HTTP proxy CONNECT returns **403** for `icuvisor-mcp.example.workers.dev`, which is absent from the effective allowlist. No network bypass was attempted. Add that hostname through supported environment configuration to run `npm run smoke -- https://icuvisor-mcp.example.workers.dev` here, or run the smoke command from an independently authorized developer environment.
- Cloudflare deployment/API success does not establish public discovery or MCP runtime success. Container startup with real credentials, API credential validity, and live tool calls remain unverified.
- User has been asked to create the ChatGPT custom MCP connection with OAuth and dynamic registration, sign in as lirantal, and report tools or an error without sharing tokens/callback URLs.
- Verify a second GitHub account is denied and receives no access tokens. Automated denial tests use a stub identity, so the real-account check remains required.
- A setup-only Worker was deployed first to allow dashboard secret entry. It was replaced by the full Worker; it is no longer the active implementation.

## Repeating checks in this environment

Use the cloud-environment runtime skill and live readiness metadata. Preserve the inherited proxy and CA trust; never disable certificate checks. Execution-tool network permission is required. `NODE_USE_ENV_PROXY=1` is required for CLI HTTP authentication/API calls. Inspect current `/etc/codex/network-policy.json` after restart.

Local ignored helpers/dependencies may need to be recreated:

```sh
npm_config_cache="$PWD/work/npm-cache" npm install --prefix work/toolchain --no-package-lock --no-save node@24.22.0
PATH="$PWD/work/toolchain/node_modules/.bin:$PATH" npm_config_cache="$PWD/work/npm-cache" npm ci
```

`work/bin/docker-with-ca` wraps the real Docker executable, injecting `--secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt` into build commands only. The public CA is not copied into image layers. Preserve the existing Docker configuration; use a private writable copy only when required by the read-only home directory.

```sh
export PATH="$PWD/work/toolchain/node_modules/.bin:$PATH"
export XDG_CONFIG_HOME="$PWD/work/config" XDG_CACHE_HOME="$PWD/work/cache"
export BUILDX_CONFIG="$PWD/work/buildx"
export WRANGLER_DOCKER_BIN="$PWD/work/bin/docker-with-ca"
export CF_SEND_TELEMETRY=false NODE_USE_ENV_PROXY=1
export DOCKER_CONFIG="$PWD/work/docker-client"
npm run preflight
npm run check
npm test
npm run build
npx cf deploy --prebuilt --mode production --dry-run
```

The writable Docker config copy and Cloudflare login are sensitive local session state under ignored `work/`. Do not archive or commit that directory. Deploy without secret environment variables or `--secrets-file` to preserve the existing dashboard secrets. Do not read them back.

## Browser consent Origin failure

The first real ChatGPT connection reached the consent page, but Continue was rejected with `Forbidden origin` before GitHub sign-in. Chromium 154 reproduced the cause on a loopback-only fixture: a form page with `Referrer-Policy: no-referrer` sends the literal `Origin: null` on its POST; `same-origin` sends the expected local origin. No credentials or actual OAuth parameters were used in the browser experiment.

The consent page now uses `Referrer-Policy: same-origin`, and the Worker response wrapper preserves it instead of overwriting it. All other responses still default to `no-referrer`. The consent POST still requires the exact canonical server Origin, and the OAuth provider still requires the browser-bound consent cookie/handle. A new integration regression verifies the final rendered policy and CSP, rejects missing/null/foreign origins (including ChatGPT itself as a POST origin), and allows the valid same-origin flow to redirect to GitHub. Cross-origin referrers remain suppressed. Type checking and all 17 tests pass. The user must start a fresh authorization flow after deployment; the already-loaded consent page retains its old policy.

Consent fix deployed successfully as version `REDACTED_DEPLOYMENT_VERSION`; the deployments API confirms 100% traffic. Build and prebuilt dry run pass. Real browser acceptance is awaiting a fresh authorization attempt; the executor public-host allowlist limitation remains unchanged.

## Browser consent redirect CSP failure

After the Origin fix, the user's next authorization reached the consent page but Chromium blocked the form's cross-origin redirect under `form-action 'self'`. A second click then received an invalid/expired authorization response, consistent with the first POST having consumed the consent handle before its redirect was blocked.

Two automated Chromium tests against the actual rendered workerd/provider fixture reproduced the exact console error before the fix, for both Continue and Cancel. The consent CSP now allows form navigation only to self, `https://github.com`, and `https://chatgpt.com`. Full origins are intentional because these services may redirect through sign-in and post-callback pages. Exact callback URI validation, strict same-origin consent POST checks, consent cookie/handle binding, S256 PKCE, canonical audience, and numeric owner validation remain enforced.

The same browser tests pass after the CSP change. All **19 tests**, TypeScript checks, full build, and prebuilt dry run pass. The browser harness uses the system Chromium/Chrome binary (or `CHROMIUM_BIN`) and Node's built-in CDP WebSocket client; it forwards only loopback traffic to the test fixture and intercepts external navigation locally without real GitHub/ChatGPT access. CI and deployment workflows require the browser tests via `REQUIRE_BROWSER_TESTS=true` instead of silently skipping when no browser is available. Real account sign-in/tool discovery still require user acceptance with a fresh OAuth flow.

CSP redirect fix deployed as version `REDACTED_DEPLOYMENT_VERSION`; Cloudflare deployments API confirms 100% traffic.

## Live authentication accepted; discovery under investigation

The user completed real GitHub OAuth consent and returned to ChatGPT successfully. ChatGPT reports OAuth authentication succeeded, but action discovery failed and Refresh tools did not recover it. Cloudflare's instance API reports the single named `owner` container running. A local image startup with the same non-secret runtime settings and dummy API key registers 22 read-only tools.

Temporary diagnostic version `REDACTED_DEPLOYMENT_VERSION` was deployed. Diagnostics are limited to owner-authorized initialization, initialized notification, tools/list, and GET stream categories. Fixed metadata only (phase, HTTP status, response media category, session-header presence, elapsed time, and fixed failure-stage code) is stored in four fixed KV keys with a 600-second TTL. No request/response body, full URL, token, cookie/header value, session identifier, tool arguments, or health data is stored. The diagnostic feature also stops automatically at `MCP_DIAGNOSTICS_UNTIL`; remove/disable it after diagnosis. An integration assertion verifies the exact diagnostic fields, and all 19 tests/type checking/build/dry run passed before deployment. The user has been asked to click Refresh tools once to populate these records. Public executor access remains blocked by the environment allowlist.

The first refresh after diagnostic deployment produced no recognized authenticated MCP records. A broader probe was deployed as version `REDACTED_DEPLOYMENT_VERSION`: it records MCP entry-point HTTP status/outcome, credential-header presence (boolean only), and an origin category, plus an `other` MCP method category. Tests assert exact diagnostic fields for anonymous 401 and authenticated forwarding. All 19 tests, type checking, build, and dry run pass. User has been asked to refresh once more; cause is not established yet.

## Modern MCP header forwarding defect

A refresh produced an authenticated gateway POST with HTTP 400 JSON, no session response header, and no container exception. The original method classifier did not recognize the request as legacy initialize/tools/list. The user also saw ChatGPT's refresh endpoint return 424; blocked browser telemetry requests do not account for the authenticated backend 400.

Inspection of the pinned Go SDK found that modern `server/discover` requires the `Mcp-Method` header. The proxy's old header allowlist dropped it. A real-container reproduction using the 2026-07-28 discovery metadata returned HTTP 400 JSON-RPC code -32020 (`missing required Mcp-Method header`) without that header, and HTTP 200 with supported stateful protocol versions when it was retained. The live structural record has not yet established the exact request method; the defect itself is reproduced independently.

The proxy now preserves `Mcp-Method`, `Mcp-Name`, and the standard `Mcp-Param-*` header family while still stripping credentials, cookies, unrelated mcp-* fields, and forwarding headers. A real-provider integration test verifies these forwarding/stripping rules. The real-container smoke test now checks modern server/discover as well as legacy initialization and 22 read-only tools, with a dummy key and no intervals.icu API calls. Type checking and all 20 tests pass. Existing short-lived diagnostics remain enabled for the acceptance attempt and must be disabled/removed after diagnosis.

Protocol-header fix deployed as version `REDACTED_DEPLOYMENT_VERSION`; deployments API confirms 100% traffic. Build and dry run pass. User has been asked to Refresh tools on the existing authenticated app. The bounded diagnostics now recognize server/discover and 2026-07-28 structural metadata without persisting request values.

## Stateless HTTP compatibility

The header fix changed real `server/discover` from HTTP 400 to HTTP 200, as confirmed by the bounded live probe. That request used protocol `2026-07-28`. ChatGPT still did not follow with initialize or tools/list. The pinned server's stateful transport advertised only older protocol versions. Its Go SDK supports 2026-07-28 only with `Stateless: true`; the pinned icuvisor CLI has no configuration flag exposing that setting.

The build now applies `patches/icuvisor-stateless-http.patch` to the same pinned source. It changes one transport-options line to `Stateless: true, JSONResponse: true`. Docker runs `git apply --check` before applying it. The patch is explicitly included in the otherwise restrictive Docker context; credentials and ignored files remain excluded. The binary version is suffixed `+stateless-http` to identify the local modification.

The managed executor disconnected during the first compilation attempt. After it recovered, the image was found fully built. The expanded real-container smoke test passes: current server/discover advertises 2026-07-28; current tools/list returns 22 read-only tools; legacy initialize/initialized/tools-list still returns the same tools; no MCP session ID is issued. Only a dummy API key was used and no intervals.icu API requests were made. Local image ID: `sha256:d529c04d04bc2974dfd288e0ed39edfcf37909b6b24b3ea8050000c3a41639cd`. Type checking and all 20 tests also pass. Live ChatGPT discovery acceptance remains pending deployment of this image and a new refresh attempt.

Stateless image deployed successfully as Worker version `REDACTED_DEPLOYMENT_VERSION`, confirmed at 100% through the deployments API. Full `cf build` and prebuilt production dry run passed before deployment. The user has been asked to refresh tools on the existing app; live acceptance is pending.

## Discovery acceptance and diagnostic cleanup

The user confirmed Refresh tools took several seconds and completed without an error after the stateless update. Live fixed-metadata records show 2026-07-28 server/discover returning HTTP 200 JSON with no session ID, followed by a tools/list request; the gateway returned HTTP 200. A real intervals.icu query still needs user verification. Suggested checks are a visible get_athlete_profile app call reporting the configured athlete ID, followed by three recent activities compared with the intervals.icu UI. No API key, token, or raw health-data response needs to be shared in this development chat.

Temporary diagnostic code, environment binding, configuration timestamp, and lifecycle stage instrumentation have been removed from source and deployed. The modern header allowlist and stateless transport changes remain. OAuth records and saved runtime secrets are preserved. Cleanup version: `REDACTED_DEPLOYMENT_VERSION`. Type checks, all 20 tests, build, and prebuilt dry run passed before deployment. Deleted the 3 remaining diagnostic KV records using a fixed diagnostic-only prefix and explicit key-name allowlist; no OAuth keys were enumerated or deleted.
