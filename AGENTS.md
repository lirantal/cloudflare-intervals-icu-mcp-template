# Working on this gateway

Read README.md, docs/ARCHITECTURE.md, docs/DEPLOYMENT.md,
docs/TROUBLESHOOTING.md, and docs/VALIDATION.md before changing deployment code.
Inspect the existing implementation; do not replace it with another template.

- Use Node from .node-version, npm ci, the pinned official cf CLI, and
  cloudflare.config.ts. Do not introduce a hand-maintained Wrangler config.
- deployment.json is a public placeholder template. Real identity/account values
  belong in ignored deployment.local.json or ICUVISOR_DEPLOYMENT_FILE.
  Never commit credentials, local settings, health data, or work/ artifacts.
- Keep read-only mode (`deleteMode: none`), exact numeric GitHub owner checks,
  S256 PKCE, canonical audience, consent cookie binding, and ChatGPT callback
  validation. No separate Cloudflare Access gate belongs in front of OAuth/MCP.
- Preserve the current MCP metadata headers. The source patch enabling stateless
  JSON Streamable HTTP is intentional: current discovery must advertise the
  current protocol, not just return HTTP 200 with older versions.
- Browser-test Continue and Cancel. HTTP-only tests missed both Referrer-Policy
  and CSP redirect failures. CI requires a Chromium/Chrome executable.
- Run npm run check, npm test, npm run build, cf prebuilt dry run, and the
  real-container smoke test for relevant changes. Ordinary builds need no secrets.
- Read the managed cloud-environment runtime skill before Docker/network work.
  Preserve inherited proxy and TLS trust. Never bypass an enforced allowlist.
- Existing production secrets are preserved by deploying without a secrets file
  or secret environment variables. Verify names/types only; never read them back.
- Review paid provisioning before first deployment. Scope changes to the selected
  account. Never overwrite a functioning gateway with a setup placeholder.
- Avoid request/body/header/URL logging. Temporary diagnostics must be bounded,
  store no identifiers or health data, and be removed after investigation.
- Record local tests, Cloudflare deployment status, real ChatGPT discovery/data
  access, and real non-owner denial separately. A stub test is not live acceptance.

## End-to-end self-hosting setup

This repository is a reusable single-owner deployment template. Carry out the
following steps for the user's own account; do not reuse the original deployment's
identity, resources, or credentials. Automate every supported step within the
user's authorization, and give concrete instructions for the browser/manual steps.
Do not stop at a plan when independent setup or verification can continue.

### 1. Inspect and choose the new or resume path

Read this file, README.md, and the linked architecture, deployment,
troubleshooting, operations, and validation docs. Inspect Git status and existing
configuration before editing. Preserve uncommitted user work. For a new instance,
work in the user's fork or clone; replacing the server implementation is not
necessary. For an existing instance, inspect ignored private configuration and
supported authentication readiness without printing their contents. Check which
resources and secrets already exist. Resume at the first incomplete step, keeping
the public origin, OAuth storage, and functioning Worker stable.

### 2. Prepare tooling and verify without production credentials

Use Node 24.22.0 from `.node-version`, Docker with Linux amd64 support, and
Chromium/Chrome. Install the pinned dependencies with `npm ci`. In managed
environments, read the runtime skill and inspect effective network/credential
readiness first; preserve the proxy and TLS verification. Follow
[managed environment guidance](docs/DEPLOYMENT.md#managed-cloud-environments)
when Docker needs the optional public CA BuildKit secret.

Run `npm run check:public`, `npm run check`, and
`REQUIRE_BROWSER_TESTS=true npm test`. Public placeholder settings suffice for
`npm run build` and `npx cf deploy --prebuilt --mode production --dry-run`.
Build `docker build --platform linux/amd64 -t icuvisor-mcp:test .`, then run
`npm run test:container`. These checks use dummy credentials and must not query
the user's health data. Resolve actual failures using the troubleshooting guide.

### 3. Authenticate Cloudflare and establish the target origin

Use existing supported CLI authentication if ready. Otherwise run
`npx cf auth login --no-browser` and guide the user through its current device
authorization prompt. Run `npx cf auth whoami`; confirm the intended account
name/ID and Workers Paid/Containers availability. A hidden credential value is
not evidence that authentication is missing.

Discover the account's Workers subdomain using supported CLI/API metadata or
guide the user to Workers & Pages → Account Details. If onboarding or a purchase
is required, explain it and let the user complete it. Choose a stable unused
Worker name together with the account subdomain; the origin is
`https://WORKER-NAME.ACCOUNT-SUBDOMAIN.workers.dev`. Review existing resources
before creating anything. Obtain authorization for the first paid provisioning;
never purchase/upgrade a plan automatically.

### 4. Fill private identity settings

Copy `deployment.json` to ignored `deployment.local.json` only if no private file
already exists, and restrict its permissions to 0600. Fill the fields according
to the [settings table](docs/DEPLOYMENT.md#private-deployment-settings): account,
Worker name, exact public origin, numeric GitHub owner ID, OAuth client ID,
athlete ID, and timezone. Keep `deleteMode: none`, `toolset: core`, and initially
`authEpoch: "1"`. Verify the numeric owner ID through the authenticated GitHub
account or GitHub user API; never infer it from a login name or copy an example.

Guide the user to find their intervals.icu athlete ID in their profile URL or
account settings and create/find the API key in intervals.icu Settings. Explain
that the athlete ID is configuration while the API key is a credential. The
server enforces read-only tool registration; do not imply a personal API key
itself is necessarily scoped read-only. Ask for non-secret settings only when
they cannot be discovered through authorized tools. Keep all personal settings
out of the committed template and public reports.

### 5. Guide manual GitHub OAuth App creation and secret entry

Give the user the exact homepage and callback derived from their origin. At
GitHub → Settings → Developer settings → OAuth Apps → New OAuth App, they create
an **OAuth App**, set homepage to `PUBLIC_ORIGIN`, callback to
`PUBLIC_ORIGIN/callback`, and leave device flow disabled. They provide its
non-secret client ID for the private settings. They generate a client secret and
enter it securely as `GITHUB_CLIENT_SECRET`; their intervals.icu API key goes
into `INTERVALS_ICU_API_KEY`. Never ask them to paste either credential into chat.

Prefer a secure local editor for ignored mode-0600 `.dev.vars` copied from
`.dev.vars.example`, or dashboard **Secret** entries on an existing Worker.
When the environment cannot accept secure local entry and the Worker does not
exist yet, follow the deployment guide's dashboard-only bootstrap instructions
to create a minimal 503 placeholder, then guide dashboard secret entry. Verify
the intended name is unused first. Never overwrite a working gateway with a
placeholder. Check secret binding names/types only; do not retrieve their values.

### 6. Validate the concrete production build and deploy

Run `npm run preflight` against the private settings. Resolve placeholders,
origin/callback mismatch, account mismatch, or unsafe modes before proceeding.
Rebuild with `npm run build` after final settings changes and inspect
`npx cf deploy --prebuilt --mode production --dry-run`. Explain that the first
full deployment provisions OAuth KV, SQLite Durable Objects, and a Container
application, with ongoing paid usage. Apply once provisioning is authorized.

For new secrets supplied locally, use
`npm run deploy -- --prebuilt --mode production --secrets-file .dev.vars`.
When dashboard secrets already exist, use
`npm run deploy -- --prebuilt --mode production` to preserve them. Choose one
secret-entry mechanism. Wait for the full command, including container rollout,
to succeed; a Worker upload alone is insufficient. Verify deployed metadata
matches the selected private settings, read-only mode, and Secret binding types.

### 7. Run public and real-client acceptance

Run `npm run smoke` against the selected origin. If network policy blocks it,
report that limit and request supported network configuration or a user-side
run; do not bypass the proxy or claim the public check passed.

Guide the user to create a ChatGPT custom app with OAuth and URL
`PUBLIC_ORIGIN/mcp`. Leave predefined client credentials blank when optional so
dynamic registration can operate. The user accepts gateway consent and GitHub
authorization with the intended owner account, then uses Refresh tools and Try
in chat. Ask for a small read-only query, such as their athlete profile or a few
recent activities. Confirm a visible tool call and that results match
intervals.icu; do not copy health-data results into logs, fixtures, or docs.

Complete the [acceptance checks](docs/OPERATIONS.md#acceptance-checks), including
a fresh connection with a different real GitHub identity being denied. Keep
automated stub denial separate from this browser check. If the user cannot test
another identity, explicitly record it as outstanding without loosening access.

### 8. Hand off a reproducible private instance

Record local checks, live deployment, public smoke, ChatGPT discovery/data use,
and non-owner denial separately. Provide the user their private connection URL
and links to operations/troubleshooting. Explain how to back up private settings
securely, rotate secrets, invalidate grants via `authEpoch`, and redeploy. Keep
the public repository generic and run `npm run check:public` before committing.
Do not commit authentication files, filled settings, build artifacts, or data.

If requested, configure manual production GitHub Actions using the documented
protected environment secrets; it is optional for CLI deployments. Do not claim
CI deployment is ready until its secrets and protections are configured. Pushes
to `main` run checks and do not automatically deploy. Finish with the concrete
results and any remaining manual checks rather than a blanket success claim.
