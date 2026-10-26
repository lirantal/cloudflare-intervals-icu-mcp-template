# Validation status — 2026-10-26

This project has been implemented locally, but has **not been deployed** or tested against real credentials.

## Completed

- Installed official `cf` 1.0.0-beta.23 as a pinned project dependency.
- Installed Node 24.22.0 under ignored `work/toolchain` for validation in this environment.
- `npm run check` passes.
- `npm test` passes: **13 tests**, using the real OAuth provider in Miniflare/workerd, with a stub GitHub identity endpoint and a stub container Durable Object.
- Tested public discovery and issuer identification, anonymous/forged bearer rejection, callback restrictions, S256 PKCE, canonical resource audience, consent cancellation and browser binding, rejection of a non-owner, successful owner authorization, credential stripping, MCP session header forwarding, untrusted Origin rejection, refresh/revocation, code replay rejection, and owner/version/scope configuration policy.
- `cf build` compiles/bundles the actual Worker successfully, then invokes Docker for the pinned Go image.
- Docker pulled the base images, fetched the pinned icuvisor source, and reached Go dependency compilation with TLS verification enabled and the environment's CA mounted as a build secret.
- The sole allowed identity is the connected GitHub account `lirantal`, numeric ID `REPLACE`. It matches the repository owner.
- Read-only policy is enforced both by deployment preflight and by the Worker's runtime configuration check; icuvisor's `ICUVISOR_DELETE_MODE=none` is passed to the container.

## Blocked or not yet run

- Full image build: the configured outbound network policy rejects a signed Go module ZIP download from `storage.googleapis.com`. This is a network policy block, not a source compiler error. That host must be allowed through the supported environment configuration workflow; no network bypass was attempted.
- Therefore the real-container initialize/tools-list smoke test, complete `cf` build output, and prebuilt deploy dry run remain unverified.
- Cloudflare account name, account entitlement/billing, Workers subdomain, token permissions, live provisioning, secret upload, and production smoke test are unverified because account credentials and runtime credentials have not been supplied.
- Browser acceptance in ChatGPT with real GitHub OAuth App credentials is pending.
- The supplied shared ChatGPT conversation had no readable transcript in the research tool. Upstream documentation was read directly from its pinned repository source where its public site was unavailable.

## Resume in this managed environment

Allow `storage.googleapis.com` for Go module redirects. For live provisioning/authentication, allow `api.cloudflare.com`, `dash.cloudflare.com`, and `registry.cloudflare.com`. Browser callbacks may require additional hosts reported by the authentication flow.

The managed environment's sandbox requires the execution tool's network permission for outbound operations. Do not unset its proxy or disable TLS verification.

`work/bin/docker-with-ca` is an ignored local wrapper that injects the public system CA bundle as a BuildKit secret. It is only needed inside this proxied development environment. On a normal developer machine and GitHub Actions, use the documented commands directly.

To repeat a full build here after the network rule is updated:

```sh
PATH="$PWD/work/toolchain/node_modules/.bin:$PATH" \
XDG_CONFIG_HOME="$PWD/work/config" \
XDG_CACHE_HOME="$PWD/work/cache" \
BUILDX_CONFIG="$PWD/work/buildx" \
WRANGLER_DOCKER_BIN="$PWD/work/bin/docker-with-ca" \
CF_SEND_TELEMETRY=false npm run build
```

Then build/tag `example-account-icuvisor:test` with the same CA secret and run `npm run test:container`. No real API key is needed for that smoke test. Fill `deployment.json` and ignored `.dev.vars`, authenticate Cloudflare, and follow README provisioning steps before the real ChatGPT browser checks.
