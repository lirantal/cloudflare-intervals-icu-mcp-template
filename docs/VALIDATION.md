# Validation status — 2026-10-27

The full MCP Worker and container image are **deployed** to the authorized example-account account. Public HTTP smoke testing, real ChatGPT OAuth/tool discovery, and real non-owner rejection are **not yet verified**.

## Production state

- Account: example-account, `REPLACE`; confirmed through authenticated Cloudflare API calls.
- The user enabled Workers Paid after reviewing base and metered costs. The subscriptions API confirms `workers_paid` in state `Paid`. The implementation did not change billing.
- Public origin: `https://icuvisor-mcp.example.workers.dev`.
- Worker version: `REDACTED_DEPLOYMENT_VERSION`, confirmed at 100% in the deployments API.
- Container image uploaded and prepared successfully: `sha256:8b6bf732474f2cb424249c757e5a41d1666f56fd2c9ddeeaebf826843eb73658`.
- OAuth KV namespace provisioned: `REDACTED_RESOURCE_ID`.
- SQLite Durable Object namespace: `REDACTED_RESOURCE_ID`.
- Both `GITHUB_CLIENT_SECRET` and `INTERVALS_ICU_API_KEY` were entered in the dashboard. Metadata-only checks after full deployment confirm both remain `secret_text`. Their values were not printed or saved locally.
- Sole owner: GitHub `lirantal`, numeric ID `REPLACE`.
- Non-secret settings are saved in `deployment.json`, including the supplied OAuth App client ID and athlete ID. Production preflight passes.

## Local verification completed

- Node 24.22.0 and official `cf` 1.0.0-beta.23; dependencies installed with `npm ci`.
- `npm run check` passes.
- `npm test` passes: **17 tests**. Fourteen use real OAuth provider code in Miniflare/workerd with stub GitHub/container endpoints. Three test native container lifecycle behavior with mocked runtime APIs.
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
