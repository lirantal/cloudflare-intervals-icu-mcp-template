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
