# Troubleshooting and implementation history

This guide records the failures encountered while continuing the existing implementation, the evidence that distinguished them, and the fixes retained in the project. Read it before changing OAuth, proxy headers, the container policy, or the source patch. Never debug by logging real tokens, callbacks, request bodies, or health data.

## Diagnose the layer first

| Symptom | First distinction |
| --- | --- |
| Build cannot download a Go module | Network policy / proxy / CA, before blaming Go source |
| CLI login says `fetch failed` | Node proxy behavior versus credential readiness |
| Consent fails before GitHub | Browser Origin, cookie binding, or CSP navigation |
| GitHub succeeds but discovery fails | Authenticated MCP exchange, supported protocol, and container response |
| ChatGPT `refresh_actions` returns 424 | A server-side dependency failed; inspect its underlying MCP request |
| Worker upload succeeds, deploy exits nonzero | Container push/preparation/provisioning may still have failed |
| Public smoke cannot connect from one executor | Check that executor's enforced outbound policy separately from the public service |

Keep local tests, deployment completion, real OAuth, real tool discovery, real data access, and non-owner rejection as separate acceptance results.

## 1. Go dependency ZIP redirect blocked

**Observed:** Docker fetched the pinned repository and reached dependency compilation, but a Go dependency ZIP redirected from the module proxy to `storage.googleapis.com`, which the enforced network policy denied.

**Why:** Allowing `proxy.golang.org` alone did not allow its signed object-storage download destination. Updating desired configuration did not change the policy of an already-running older environment.

**Fix:** Use supported environment configuration, then inspect live readiness and `/etc/codex/network-policy.json` in the actual executor. Require current observations and `network_policy.state: enforced`; check the effective host list. A revision number alone does not prove the right or wrong host set: a replacement environment can start at revision 1 with the updated configuration.

Do not change routes, unset the managed proxy, or disable TLS verification to evade a policy denial. Registry/API hosts and the actual public Worker hostname have separate allowlist requirements.

## 2. TLS inside Docker and read-only home paths

**Observed:** Networked build steps needed the managed public CA. npm/buildx and later Docker registry login attempted to write under a read-only home directory.

**Why:** Inner build containers do not inherit the executor's CA files or writable cache paths. Docker's client proxy defaults do not configure every tool's trust. A registry login writes client credentials even when the Worker itself has already uploaded successfully.

**Fix:** Read the cloud-environment runtime skill. Preserve the inherited proxy and registry settings. Mount the combined public system CA as the optional BuildKit secret `proxy_ca`; Git uses `GIT_SSL_CAINFO`, Go uses `SSL_CERT_FILE`. The mount exists only during the networked RUN and is not copied into the final image.

Use ignored workspace npm/XDG/buildx directories. Where registry login cannot write the existing Docker config, make a mode-0700 writable directory with an opaque mode-0600 copy of its config; select it only for the relevant commands. Preserve credentials and proxy defaults; do not print its contents. Keep all credential-bearing helpers under ignored `work/`.

## 3. Node version and cf/Vite compatibility

**Observed:** The default Node version was below the pinned CLI requirement, and the stable Vite plugin did not support the new programmatic configuration format.

**Fix:** Use `.node-version` (24.22.0), `npm ci`, pinned `cf` 1.0.0-beta.23, and the compatible beta Vite plugin from package-lock.json. A local toolchain can live under ignored `work/toolchain` if the host Node is older. Recreate it after environment loss rather than changing package versions just to make the host work.

The CLI discovers a dev server from the project package.json. An isolated setup-only project needs the plugin declared in its own package.json even when its modules resolve from an ancestor node_modules directory. Copy the root Vite configuration for that project.

## 4. Cloudflare device login failed before producing a code

**Observed:** `cf auth whoami` reported no saved login; `cf auth login --no-browser` failed with `fetch failed` despite the login hosts being allowed.

**Why:** Node's built-in HTTP client was not using the inherited environment proxy.

**Fix:** In this managed environment, use Node 24.22.0 with `NODE_USE_ENV_PROXY=1`, preserving proxy variables and CA trust. Device authorization then produced a code and completed in the user's browser. The CLI stores credentials under the chosen XDG config path; do not read the token to prove login. Use readiness metadata and normal CLI authentication checks. Never paste device/session credentials into docs or source.

## 5. No workers.dev subdomain or paid entitlement yet

**Observed:** The subdomain API returned error 10007. The account's subscriptions list was empty, while a Workers `standard: true` response existed.

**Why:** The Workers landing page had not been initialized. The `standard` usage setting was not evidence of a Workers Paid subscription or Containers entitlement.

**Fix:** Open the intended account's Workers & Pages page and complete free onboarding to establish the subdomain. Verify the intended account and review paid provisioning separately. The user enabled the paid plan in the dashboard; the project did not change billing. Do not silently deploy to a temporary account or enable a plan on their behalf.

## 6. Where to enter secrets before a Worker exists

**Observed:** The user could find Secrets Store, but Worker runtime settings had no app to select. Updating the execution environment's secrets would require a restart.

**Fix:** Use an ignored local secrets file where practical. Otherwise, after confirming no existing Worker of the same name, deploy a minimal setup-only Worker returning 503 with no containers/storage bindings, then enter secrets directly in its dashboard. Replace it with the real implementation, preserving those secrets. See [deployment](DEPLOYMENT.md#dashboard-only-setup-before-the-real-worker-exists).

Cloudflare Secrets Store is unnecessary for this architecture. Do not overwrite a functioning gateway with a placeholder just to edit its secrets.

## 7. Dashboard entries were plain variables, not secrets

**Observed:** The UI suggested a Wrangler snippet containing the entered values. Metadata showed both names as `plain_text`, and the Worker secrets list was empty.

**Why:** The dashboard entry type had not been changed to Secret.

**Fix:** Recreate/change both `GITHUB_CLIENT_SECRET` and `INTERVALS_ICU_API_KEY` as **Secret**, then save/deploy the settings. Verify only names and `secret_text` types. An empty `vars` suggestion is consistent with removal of plain variables. Do not copy the snippet or values into this project; `cloudflare.config.ts` declares secret bindings without values.

## 8. Worker uploaded but container creation failed

**Observed:** Upload/provisioning logs looked successful, then deployment failed at registry login or application creation.

**Why:** Worker upload, image push/preparation, Container application provisioning, and trigger deployment are distinct steps. One successful step does not establish a finished deployment.

**Fix:** Wait for full CLI completion. Resume from the concrete failing layer, retaining the selected account and inherited resources. Registry-login home write failures are covered above. The next container application error required the scheduling-policy change below. Do not deploy a stale prebuilt artifact after changing configuration.

## 9. Account rejected the default container scheduling policy

**Observed:** Application creation failed with `VALIDATE_INPUT`: this account cannot use the default policy and must use `durable_object`.

**Fix:** `defineContainer` now uses `schedulingPolicy: 'durable-object'` with a named `server` image. The native Durable Object Container API supplies that image and `instance: 'lite'` at startup. It restores a ten-minute inactivity timeout, checks readiness, and replaces older images deliberately. The old helper did not forward the required startup image.

The new policy does not support `max_instances`. The gateway always routes to the same `owner` Durable Object; do not pretend this is an account-level spending limit or add an unsupported config property.

## 10. cf beta treated a same-Worker binding as cross-Worker

**Observed:** Dry run rejected the new-policy container because its Durable Object binding had `script_name`, even though it referred to the same Worker.

**Why:** The pinned beta CLI emitted that field for the normal typed self-binding and then rejected any such field in its container validator.

**Fix:** Use the supported unsafe-metadata configuration escape hatch to emit a native `durable_object_namespace` binding with only `class_name`, while the exported class declares SQLite storage and its container. The deployed binding remains a private Durable Object binding, not a public access bypass. Keep this workaround until a reviewed CLI update fixes the self-binding behavior. Local dev simulation may need an unsafe-binding plugin; explicit Miniflare fixtures are verified.

## 11. Continue with GitHub returned `Forbidden origin`

**Observed:** The consent page rendered, but its form POST failed before any GitHub login. Chromium reproduced `Origin: null` when the page used `Referrer-Policy: no-referrer`.

**Why:** The policy caused the browser to suppress the form Origin, while the handler correctly required the canonical Worker origin. HTTP-only tests had supplied an Origin directly and missed browser behavior. The global response wrapper also overwrote page-specific referrer policy.

**Fix:** The consent page uses `same-origin`, and the global wrapper preserves it. Other responses default to `no-referrer`, suppressing cross-origin authorization URL leakage. Keep the strict Origin check and provider cookie/handle binding; do not fix this by accepting opaque/null origins. A fresh consent page is required after policy changes.

## 12. Chromium blocked the form under `form-action 'self'`

**Observed:** Continue showed a CSP violation naming the local /authorize destination. Cancel also failed in the browser regression. A second click then showed `Invalid or expired authorization request`.

**Why:** Chromium applies `form-action` to redirects too. The first POST could consume the single-use consent handle before its redirect to GitHub or ChatGPT was blocked. Clicking again reused that consumed handle.

**Fix:** Permit form navigation only to self, `https://github.com`, and `https://chatgpt.com`; keep frame/base restrictions and callback validation. Full trusted origins are intentional because sign-in/callback chains can contain more than one path. Start a fresh authorization flow after the fix.

Real Chromium tests now submit both Continue and Cancel against the actual workerd/provider fixture. External navigation is intercepted locally; no real GitHub credentials are used. CI requires these browser tests instead of silently skipping them.

## 13. OAuth succeeded but action discovery failed with HTTP 400

**Observed:** GitHub authorization and return to ChatGPT succeeded. Refresh tools returned a generic error; the ChatGPT backend `refresh_actions` call returned 424. A temporary bounded server probe eventually captured an authenticated MCP POST returning HTTP 400 JSON, proving the request had reached Cloudflare.

**Why:** The proxy's strict header allowlist stripped newer standard MCP metadata. In the pinned Go SDK, a valid 2026-07-28 `server/discover` without `Mcp-Method` returned JSON-RPC header mismatch code -32020 and HTTP 400.

**Fix:** Preserve `Mcp-Method`, `Mcp-Name`, and schema-annotated `Mcp-Param-*`, alongside existing protocol/event fields. Continue stripping bearer tokens, cookies, forwarding fields, and unrelated mcp-* headers. Integration tests verify both preservation and stripping; the actual container smoke test exercises discovery with the required metadata.

Do not turn on broad header or body logging to inspect this. Method categories, status, protocol version enums, and fixed failure stages were sufficient; temporary diagnostics were later removed.

## 14. Discovery returned 200 but ChatGPT still found no tools

**Observed:** After the header fix, real `server/discover` used 2026-07-28 and returned HTTP 200. ChatGPT did not continue to initialize/tools/list. The stateful server advertised only older supported protocols.

**Why:** The pinned SDK supports the current protocol only in stateless HTTP mode. The upstream transport helper exposes the option, but the pinned icuvisor CLI does not offer a flag for it. A successful HTTP status alone did not establish compatible discovery.

**Fix:** Build the same pinned source with the checked one-line patch enabling `Stateless: true, JSONResponse: true`. Mark the binary version with `+stateless-http`. The real-container smoke test now requires current discovery to advertise 2026-07-28 and current tools/list to return the same 22 read-only tools as legacy initialization. No session ID is issued. The user then confirmed Refresh tools and a real training-data query worked.

Do not fake the supported-version list in the Worker, bypass initialization checks, or blindly translate a new protocol into an older one.

## 15. Browser console noise was misleading

**Observed:** The browser displayed `ERR_BLOCKED_BY_CLIENT` for Statsig/telemetry requests, a 424 on `refresh_actions`, and `Method Not Allowed` when that refresh URL was opened in a tab.

**Meaning:** The telemetry errors were consistent with a content blocker, not proof that MCP failed locally. The authenticated server-side HTTP 400 provided stronger evidence. Opening the refresh URL sent GET, while its UI operation used POST, so Method Not Allowed was expected.

**Fix:** Use the relevant request's status and sanitized server-side protocol evidence. Do not disable privacy extensions as a first response to unrelated telemetry noise. Do not paste cookies, full OAuth URLs, or copied authenticated requests into support chats.

## 16. Executor lost connection during Go compilation

**Observed:** The execution server disconnected, environment context became unavailable, and status initially reported configuration changes.

**Fix:** Wait for actual usable environment context and recheck live status. Inspect Git changes, local helpers, Docker health, and existing images before rebuilding. In this case, the source patch and helpers persisted and Docker had completed the image while the client was disconnected. The image still needed smoke testing before deployment; completion was not assumed from elapsed time. Do not start another daemon or claim a deployment happened during an unavailable environment.

## 17. Public smoke blocked while users could reach the service

**Observed:** The managed executor's proxy returned HTTP CONNECT 403 for the public Worker hostname. Cloudflare API/deployment access still worked; the user could authenticate and later query real data through ChatGPT.

**Why:** The public hostname was not in that executor's effective allowlist. Its network restriction was independent of Cloudflare's runtime egress and the public service.

**Fix:** Add the exact hostname through supported configuration or run the smoke test from an independently authorized developer environment. Do not bypass the proxy. Label the executor smoke test as blocked, while separately recording real browser/tool acceptance.

## 18. Public repository privacy and branch handoff

**Observed:** Private credentials were never committed, but tracked configuration and chronological notes contained non-secret account/athlete identifiers. The repository originally had only the implementation branch and no `main`.

**Fix:** Use public placeholder settings with ignored `deployment.local.json`, selected by a shared loader across cf/preflight/smoke/CI. Restore production settings through a protected GitHub environment for manual deployment. Use generic examples and remove deployment-specific resource/version IDs from published docs. Scan the final tree and all Git history with redacted output. The owner separately authorized a history rewrite to replace known deployment identifiers and the personal author email. Rescan the rewritten reachable history and use a force-with-lease push. Do not describe this as erasure of external clones or hosting caches.

Before publishing `main`, inspect remote refs, run the appropriate checks, commit the feature branch, then fast-forward/create `main` from the reviewed commit. Pushing main runs verification only; production deployment remains manual.

## What not to skip next time

- Read live enforced policy, not just desired configuration.
- Keep TLS verification and inherited proxy/registry configuration intact.
- Browser-test both consent actions, not just HTTP status/redirect headers.
- Preserve current MCP protocol headers and test the advertised protocol, not merely status 200.
- Test the actual container with a dummy key before real authorization.
- Keep private settings and runtime secrets out of the public tree and Docker context.
- Verify real owner tools/data and real non-owner denial separately.
- Remove temporary diagnostics and preserve OAuth grants/secrets during cleanup.
