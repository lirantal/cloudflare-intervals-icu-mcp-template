# Deployment

## Requirements

- Node **24.22.0**, npm, and Docker supporting Linux amd64.
- Chromium or Chrome for browser consent tests; set `CHROMIUM_BIN` if it is not on PATH.
- A Cloudflare account with Workers Paid and access to Containers, SQLite Durable Objects, and KV. Review current pricing/entitlements before provisioning. The project does not upgrade billing automatically.
- A Workers subdomain or another stable public HTTPS origin.
- A **GitHub OAuth App**, not a GitHub App installation, and the owner's verified numeric GitHub user ID.
- An intervals.icu athlete ID and API key.

Use the pinned official `cf` CLI via `npx cf`. The beta Vite plugin is deliberate: the stable plugin version originally used did not understand `cloudflare.config.ts`. Do not replace the configuration format with a hand-maintained Wrangler file.

## Private deployment settings

```sh
npm ci
cp deployment.json deployment.local.json
chmod 600 deployment.local.json
```

Edit only `deployment.local.json`. `deployment.config.ts` selects, in order:

1. The file selected by `ICUVISOR_DEPLOYMENT_FILE`, when set. A missing/invalid explicit file fails; there is no silent fallback.
2. Ignored `deployment.local.json`, when present.
3. The public placeholder `deployment.json`, suitable for build/CI but rejected by production preflight.

All CLI configuration, preflight, and smoke commands share this loader. Paths selected by the environment variable are resolved relative to the repository root. Invalid JSON errors do not include configuration contents.

| Setting | How to fill it |
| --- | --- |
| `accountId` | Copy from the intended Cloudflare account; verify its name and plan after CLI login |
| `workerName` | The stable Worker name, for example `icuvisor-mcp` |
| `publicOrigin` | Exact HTTPS origin, for example `https://icuvisor-mcp.example.workers.dev`; no trailing slash |
| `allowedGithubUserId` | Verified numeric GitHub user ID, as a string; do not use the mutable login name |
| `githubClientId` | GitHub OAuth App client ID |
| `athleteId` | Exact intervals.icu ID, such as `i12345` or `12345` |
| `timezone` | IANA timezone for the athlete; template defaults to `UTC` |
| `deleteMode` | Must remain `none` |
| `toolset` | `core` by default; `compact` or `full` are optional catalog choices |
| `authEpoch` | Start with `1`; change it and redeploy to invalidate existing authorizations |

These are not API credentials, but account/athlete identifiers and timezone can be personal. They remain private configuration. Never commit your filled settings into the public template. If `CLOUDFLARE_ACCOUNT_ID` is set, preflight requires it to match the chosen settings file.

## Authenticate and establish the origin

```sh
npx cf auth login --no-browser
npx cf auth whoami
```

Complete the device authorization in the browser. Check the selected account name/ID, not merely the dashboard's currently selected project. Do not select temporary-account deployment for a persistent private gateway.

Open the account's **Workers & Pages** landing page to establish a missing `workers.dev` subdomain. The final URL is `https://WORKER-NAME.ACCOUNT-SUBDOMAIN.workers.dev`. Reading the subdomain is not the same as verifying paid-plan entitlement. Review the Workers plan and Containers availability before the full deploy.

Cloudflare CLI discovery uses `cf cli search "generic action and resource"`, then the selected command's help/schema. Search queries must not include private account IDs, hostnames, email addresses, or credentials.

## Create the GitHub OAuth App

At GitHub → Settings → Developer settings → OAuth Apps → New OAuth App:

| Field | Value |
| --- | --- |
| Application name | A descriptive private connector name |
| Homepage | Your `publicOrigin` |
| Authorization callback | Your `publicOrigin` plus **`/callback`** |
| Device flow | Leave disabled |

Save its client ID in private settings. Generate its client secret and store it securely as `GITHUB_CLIENT_SECRET`. The Worker requests `read:user` to verify identity, not repository permissions. Verify the numeric owner ID against the intended GitHub account.

This callback is **GitHub → Worker**. ChatGPT's separate callback is validated by the provider and must not be entered as the GitHub App callback.

## Supply runtime secrets

Required secret names:

- `GITHUB_CLIENT_SECRET`
- `INTERVALS_ICU_API_KEY`

For a normal first deployment, create an ignored local file:

```sh
cp .dev.vars.example .dev.vars
chmod 600 .dev.vars
# Enter both secret values with a secure local editor.
```

Run the first deploy with `--secrets-file .dev.vars`. Do not pass secrets through command-line arguments, JSON identity settings, chat, logs, Docker build arguments, or Git.

When a Worker already exists, the dashboard path is **Workers & Pages → Worker → Settings → Variables and Secrets**. Choose **Secret**, not plain text. Plain variables may be displayed in a suggested configuration snippet. Verify only binding names/types; do not retrieve secret values. A dashboard suggestion for `wrangler.jsonc` does not mean this project needs that file.

### Dashboard-only setup before the real Worker exists

If the user cannot enter secrets into the execution environment without restarting it, a minimal Worker can provide a dashboard secret-entry screen first. **Use this only when no Worker of the intended name already exists.** Never replace a working gateway with a setup placeholder. It needs no Containers, KV, or Durable Object bindings and should return only 503 `Setup pending`.

Create an ignored `work/bootstrap` project with the same pinned `cf`/Vite dependencies declared in its `package.json` (modules resolve from the root's installed dependencies). Copy the root `vite.config.ts`. Its configuration can import private settings without copying them:

```ts
// work/bootstrap/cloudflare.config.ts
import { defineConfig } from 'cf/config';
import settings from '../../deployment.config.ts';
export default defineConfig({
  accountId: settings.accountId,
  worker: {
    name: settings.workerName,
    entrypoint: './index.ts',
    compatibilityDate: '2026-10-26',
    workersDev: true,
    previewUrls: false,
    observability: { enabled: false },
  },
});
```

```ts
// work/bootstrap/index.ts
export default {
  fetch() {
    return new Response('Setup pending\n', {
      status: 503,
      headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    });
  },
};
```

From that directory, use `../../node_modules/.bin/cf build`, then `cf deploy --prebuilt --mode production --dry-run`, inspect the zero-binding result, and deploy the placeholder. Add both dashboard Secret entries. Return to the repository root for the real build/deploy, without a secrets file, preserving the saved secrets. Placeholder success is not MCP deployment success.

## Validate and deploy

```sh
npm run preflight
npm run check
REQUIRE_BROWSER_TESTS=true npm test
npm run build
npx cf deploy --prebuilt --mode production --dry-run
docker build --platform linux/amd64 -t icuvisor-mcp:test .
npm run test:container
# First deployment with a local secrets file:
npm run deploy -- --prebuilt --mode production --secrets-file .dev.vars
# Or, when dashboard/deployed secrets already exist, preserve them:
# npm run deploy -- --prebuilt --mode production
npm run smoke
```

`cf` provisions OAuth KV, the SQLite Durable Object namespace, and the Container application in the configured account. A successful Worker upload can precede a container failure; wait for the entire command to finish and inspect its result. Never claim a full deployment from an upload log alone. Repeat deployments reuse provisioned resources.

Without a secrets file or secret environment variables, the deployment preserves saved Worker secrets. Supplying both runtime secret environment variables creates an ignored temporary mode-0600 secrets file, removes it afterward, and strips those values from the child build/deploy environment. Supply both together; do not combine multiple secret-entry mechanisms in the same command.

The `--prebuilt` artifact must come from the settings/source you intend to deploy. Rebuild after changing private identity settings, transport code, or the source patch. Use dry run before applying it. No code is automatically deployed when this repository is pushed.

## GitHub Actions

`ci.yml` checks PRs and `main` pushes with a checksum-pinned Gitleaks history scan, a public-template/tracked-file guard, type checking, required Chromium browser tests, `cf build`, prebuilt dry run, and real-container smoke. It uses public template settings and dummy API credentials. It needs no production secrets and provisions no paid resources.

`deploy.yml` is **workflow_dispatch** only and requires `main`. Create a GitHub `production` environment; configure:

| Environment secret | Content |
| --- | --- |
| `ICUVISOR_DEPLOYMENT_JSON` | JSON contents of the private deployment settings, without runtime API secrets |
| `CLOUDFLARE_API_TOKEN` | Account-scoped deployment token |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `INTERVALS_ICU_API_KEY` | intervals.icu API key |

The workflow writes private settings to an ignored mode-0600 file and masks individual string values before tooling uses them. Configure required reviewers if desired. Without these secrets, manual production CI deployment is intentionally unavailable; the already deployed Worker and authenticated local CLI are separate.

Cloudflare token permissions must cover Worker deployment/secrets, KV, SQLite Durable Objects, Containers, and the managed registry. Scope to the intended account. Consult the current API token editor and official Containers deployment docs for permission names. A workers.dev deployment does not require zone/DNS permissions.

## Managed cloud environments

Read the cloud-environment runtime skill, live readiness metadata, and `/etc/codex/network-policy.json` after recovery/restart. Require current observations and `enforced` policy. Preserve proxy variables and TLS verification. Expected build/API hosts include `storage.googleapis.com`, GitHub/package-manager hosts, `api.cloudflare.com`, `dash.cloudflare.com`, `registry.cloudflare.com`, and `container.registry.cloudflare.com`. Public smoke testing additionally needs the actual Worker hostname allowed through supported configuration.

Node may require `NODE_USE_ENV_PROXY=1` for CLI HTTP requests. Put npm, XDG, and buildx caches under ignored `work/` if home is read-only. For networked Docker steps, supply the public system CA bundle as the optional `proxy_ca` BuildKit secret; never COPY it into the final image. A command-scoped writable copy of the existing Docker client configuration can accommodate registry login while preserving original proxy/registry settings and credentials. Keep it private and ignored. Full symptoms and recovery steps are in [troubleshooting](TROUBLESHOOTING.md).
