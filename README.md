# Private ICU Visor MCP on Cloudflare

A single-owner ChatGPT MCP connector: Cloudflare Worker + Workers OAuth Provider + Durable Object-managed container, building [icuvisor](https://github.com/ricardocabral/icuvisor) from pinned Go source. The target account is **example-account**, `REPLACE`. Data access is **read-only**, as requested. The owner is `lirantal` (GitHub ID `REPLACE`).

**Current status:** Deployed to example-account. Type checks, 20 tests, source container build, the local Streamable HTTP smoke test (22 read-only tools), `cf build`, and the production dry run pass. Public smoke testing is blocked by the managed environment allowlist; real GitHub sign-in through ChatGPT succeeded, while tools discovery and non-owner browser checks remain pending. See [validation status](docs/VALIDATION.md).

## Architecture

```mermaid
sequenceDiagram
  participant C as ChatGPT
  participant W as Worker / OAuth provider
  participant B as Your browser
  participant G as GitHub
  participant D as Durable Object / Container
  participant I as intervals.icu
  C->>W: /mcp (no token)
  W-->>C: 401 + protected resource discovery
  C->>W: Discover metadata; register OAuth client
  C->>B: Open /authorize (S256 PKCE)
  B->>W: Review client and approve consent
  W->>G: Browser sign-in with separate state + PKCE
  G->>W: /callback
  W->>G: Exchange code; read authenticated numeric user ID
  W->>W: Match the single allowed owner ID
  W-->>C: Authorization code + state + issuer
  C->>W: /token with verifier + resource
  W-->>C: MCP access and refresh tokens
  C->>W: /mcp with bearer token
  W->>W: Validate token, owner, scope, authorization version
  W->>D: Forward HTTP request without credentials/cookies
  D->>I: API request using runtime secret
```

The Worker is both the MCP authorization server and resource gateway. GitHub only establishes your identity; ChatGPT receives this Worker's tokens, never your GitHub token or intervals.icu API key. OAuth discovery and client registration are publicly reachable protocol endpoints. Registering a client grants no data access. Only the configured numeric GitHub ID can complete authorization. Callback destinations are restricted to ChatGPT.

Cloudflare Access is unnecessary for this design. A generic Access login page in front of `/mcp`, `/token`, or `/.well-known/*` would interrupt protocol discovery and bearer-token requests. The container has no independent public hostname, port mapping, ingress route, or bypass URL. Only authorized Worker requests invoke its Durable Object binding.

The Worker routes all authorized traffic to a single named owner Durable Object. The native Container API sets a ten-minute inactivity timeout. This account requires the `durable_object` scheduling policy, which does not support an application-level `max_instances` limit; the single instance is enforced by routing in application code. The Durable Object selects the digest-pinned `server` image and `lite` instance size at startup, restores the inactivity timeout after eviction, and replaces an old image when handling the next request after deployment.

HTTP transport is **stateless Streamable HTTP with JSON responses**. The pinned Go SDK supports the current `2026-07-28` protocol only in stateless mode, while the pinned icuvisor CLI does not expose that option. The build applies the one-line [transport patch](patches/icuvisor-stateless-http.patch) and identifies the binary as the upstream commit plus `+stateless-http`. Modern `server/discover`/`tools/list` and legacy initialization/tool listing are both smoke-tested. No MCP session ID is issued; an interrupted tool request is never retried automatically.

## Requirements

- Node **24.22.0** (see `.node-version`) and npm; Docker running, with Linux amd64 builds supported.
- A Cloudflare account on a plan supporting Workers, SQLite Durable Objects, KV, and Containers. Review/enable paid Workers and Containers for **example-account** during provisioning; this project never changes billing automatically.
- A GitHub account and a **GitHub OAuth App** (not a GitHub App installation).
- Your intervals.icu athlete ID and API key.
- An HTTPS Worker URL (`workers.dev` is sufficient; no purchased domain needed).

Tests include real Chromium form navigation with stubbed GitHub/ChatGPT destinations. Install Chromium or Chrome (or set `CHROMIUM_BIN`) to run those two browser tests; CI requires them through `REQUIRE_BROWSER_TESTS=true`.

Dependencies and the upstream source commit are pinned. `cf` is Cloudflare's official beta CLI, installed locally by `npm ci`; use `npx cf`. The compatible **beta Vite plugin** is intentional: its stable 1.x series does not read the new `cloudflare.config.ts` format. `cf` handles provisioning, container builds, and deployment. There is no hand-maintained Wrangler configuration.

## Configure and deploy

1. Install dependencies:

   ```sh
   npm ci
   npx cf --version
   ```

2. Authenticate with `npx cf auth login --no-browser` (device authorization works on a remote terminal), or configure `CLOUDFLARE_API_TOKEN` securely in your environment. Never paste tokens into source control or chat. Keep the account selection in `deployment.json`; an overriding `CLOUDFLARE_ACCOUNT_ID` must equal the example-account ID. Confirm the account name and paid plan in the dashboard before first deployment. An account ID is the deployment boundary, independent of the dashboard's selected project.

3. Set the non-secret values in `deployment.json`:

   | Field | Value |
   | --- | --- |
   | `publicOrigin` | `https://icuvisor-mcp.<your-workers-subdomain>.workers.dev`, no trailing slash |
   | `allowedGithubUserId` | Your numeric GitHub `id`, stored as a string; obtain it from `https://api.github.com/users/YOUR_USERNAME` |
   | `githubClientId` | GitHub OAuth App's client ID |
   | `athleteId` | Your exact intervals.icu athlete ID, e.g. `i12345` or `12345` |
   | `timezone` | Your IANA timezone; currently `UTC` |
   | `deleteMode` | `none`: excludes every write/delete tool |
   | `toolset` | `core` by default; `compact` or `full` changes catalog size, not read-only policy |
   | `authEpoch` | `1` initially; change to a new value and redeploy to invalidate all existing owner grants |

   Create the GitHub OAuth App at GitHub → Settings → Developer settings → OAuth Apps. Set its homepage to `publicOrigin`, its authorization callback to **`publicOrigin + /callback`**, and leave device flow disabled. This is the **GitHub → Worker callback**, separate from ChatGPT's callback. No GitHub repository permissions are requested; sign-in requests `read:user`.

4. Put the two runtime secrets in an ignored local file:

   ```sh
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars securely:
   # GITHUB_CLIENT_SECRET=...
   # INTERVALS_ICU_API_KEY=...
   chmod 600 .dev.vars
   ```

   Alternatively, create a minimal setup Worker at the final name and enter both values as **Secret** entries in its dashboard. A full deployment without `--secrets-file` or secret environment variables preserves those saved secrets; do not copy dashboard secret values into configuration files.

   The intervals.icu key comes from its settings/API page. It may itself allow writes; the server is configured to register read-only tools only. No secret is a Docker build argument or image layer. The container receives the API key through its Durable Object's runtime environment.

5. Verify and deploy:

   ```sh
   npm run preflight
   npm run check
   npm test
   npm run build
   npx cf deploy --prebuilt --mode production --dry-run
   docker build -t example-account-icuvisor:test .
   npm run test:container
   npm run deploy -- --prebuilt --mode production --secrets-file .dev.vars
   npm run smoke -- https://icuvisor-mcp.YOUR-SUBDOMAIN.workers.dev
   ```

   `cf` auto-provisions the KV binding, SQLite Durable Object namespace, and Container application in the selected account. The pinned beta CLI emits a conflicting cross-Worker field for self-bindings; `cloudflare.config.ts` uses the supported unsafe-metadata escape hatch for the local Durable Object binding until that CLI issue is fixed. The preflight deliberately rejects placeholders, account overrides, and a write-enabled safety mode. After the first deploy, `npm run deploy` preserves existing deployed secrets unless you pass `--secrets-file` or supply **both** secret environment variables. With environment variables, the deployment script creates a temporary mode-0600 secrets file under ignored `work/`, removes it afterward, and strips those variables from the build/deploy child process.

   If your Worker name or account Workers subdomain changes, update `publicOrigin` and the GitHub callback together before deploying. Custom domains require adding the domain to `cloudflare.config.ts` and using that origin consistently. Preview URLs are disabled.

## Add to ChatGPT

Enable developer mode in the ChatGPT settings if required by your plan/workspace, then create a custom remote MCP connection:

- URL: **`https://YOUR-WORKER.workers.dev/mcp`**.
- Authentication: **OAuth**.
- Registration: dynamic client registration, using the advertised `/register` endpoint. Leave pre-defined OAuth client ID/secret blank when the UI permits DCR. The GitHub app client ID/secret belong exclusively to the Worker.
- Follow consent, sign in to the allowlisted GitHub account, and let ChatGPT discover the tools.

The provider advertises issuer identification and returns `iss`, so current ChatGPT clients can use `https://chatgpt.com/connector_platform_oauth_redirect`. Callback-ID URLs of the form `https://chatgpt.com/connector/oauth/{callback_id}` are also allowed for supported clients. Use the exact callback shown in ChatGPT's MCP management screen if the UI has changed. CIMD is disabled; this project uses DCR. The minimal scope is `mcp:use`; the canonical resource/audience is the exact **origin + `/mcp`**.

Before normal use, verify both outcomes in a browser: your account connects and lists tools; a different GitHub account receives access denied and no tokens. The automated OAuth tests stub GitHub identity, so these real-account acceptance checks are still required. No connector is published in an app directory.

## CI and deployment

`.github/workflows/ci.yml` checks every PR and `main` push with type checking, OAuth integration tests in the Workers runtime, a full `cf` build, deployment dry run, and a real container MCP smoke test using dummy credentials. It does not need production secrets.

`.github/workflows/deploy.yml` deploys from `main` using **workflow_dispatch**, a `production` GitHub environment, and the same checks. Configure these environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `OAUTH_GITHUB_CLIENT_SECRET`
- `INTERVALS_ICU_API_KEY`

The environment name uses GitHub's deployment controls; add required reviewers if you want them. Deployment is manual by default so pushing unfinished setup does not provision paid resources. Add a `push: branches: [main]` trigger later if you want automatic production deployment.

Scope the Cloudflare token to example-account. It needs the current API permissions to deploy Workers and secrets, provision KV and SQLite Durable Objects, and build/push/update Containers and their registry. Cloudflare's API token editor and Containers deployment guide are the authority for current permission names; do not use a token for a different account. `workers.dev` avoids zone/DNS permissions. OAuth CLI login is convenient for initial provisioning; CI uses the account-scoped token.

## Operations and limits

- **Emergency lockout:** change `authEpoch` in `deployment.json`, redeploy. The owner/scope/version check rejects old tokens on every MCP call and token refresh. Changing the allowed GitHub ID also rejects prior grants. Updating a config file alone does not revoke anything until deployed. Requests already in progress may finish.
- **Secrets:** rotate with another deployment using `--secrets-file .dev.vars`. Restart/deploy the container so its runtime environment picks up a changed intervals.icu key. Change `authEpoch` when invalidating ChatGPT authorizations. Removing the GitHub OAuth App alone does not revoke already-issued Worker tokens.
- **HTTP transport:** stateless requests use the current protocol or legacy initialization without an MCP session ID. Container restart can interrupt an in-flight call; the gateway never retries it. Protocol headers are preserved, including `Mcp-Method`, `Mcp-Name`, and schema-annotated `Mcp-Param-*` metadata required by modern clients.
- **Logging:** Worker observability is disabled to avoid collecting OAuth callback query strings. Do not add request URL/body/header logging: these can contain codes, cookies, tokens, health data, or API results. Cloudflare/GitHub may still retain platform security/audit information.
- **OAuth storage:** the maintained provider stores clients, grants and encrypted transaction data in KV. Its cookie binding and PKCE prevent cross-browser callback theft. KV's eventual consistency means simultaneous redemption is not a globally atomic single-use guarantee; this project does not claim otherwise. See the provider's upstream-sign-in documentation.
- **Exposure:** public discovery/registration/token endpoints are necessary. They reveal no training data but can receive traffic and consume quota. DCR is restricted to ChatGPT callbacks; this does not prove the registrant is OpenAI. Your identity check remains the authorization boundary. Add Cloudflare rate limits if real abuse appears, keeping discovery and ChatGPT's OAuth flow reachable.
- **Cost:** Workers paid-plan charges plus Containers CPU/memory/disk and applicable KV/DO usage. Single-owner routing and idle sleep reduce idle use but do not impose a hard spend cap. Review current Cloudflare pricing during provisioning.
- **Local development:** `npm run dev` launches the Cloudflare development tooling. The beta CLI local-binding escape hatch may require a local simulation plugin; the Miniflare OAuth integration tests use an explicit stub binding and are the verified local workflow. The strict canonical HTTPS origin and secure browser cookies are intentional. Unit/integration tests work without a public URL; real browser OAuth needs the configured HTTPS deployment, or an explicitly configured HTTPS development endpoint and separate GitHub app. Do not expose a naked Docker port publicly.

## Sources

- [Cloudflare `cf` overview](https://developers.cloudflare.com/cf/) and [programmatic configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/)
- [Cloudflare CI guidance](https://developers.cloudflare.com/cf/ci/) and [Containers pricing](https://developers.cloudflare.com/containers/platform-details/pricing/)
- [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider), especially `docs/upstream-sign-in.md` in the pinned package
- [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth)
- [icuvisor source](https://github.com/ricardocabral/icuvisor/tree/069f893e91819a454da80015df8f2ae6158707ae) and its `web/content/guides/http-transport.md`
- [Reference gateway](https://github.com/levrado/mcp-oauth-gateway-cf) supplied as architectural context; this implementation adds consent, numeric identity checks, audience pinning, strict callback checks, and tests.

The supplied shared ChatGPT conversation did not expose readable transcript content to the research tools, so no implementation assumption relies on it.
