# Operations and acceptance

## Acceptance checks

Keep these separate in reports:

1. **Local checks:** type checking, OAuth tests, Chromium navigation, image build, current/legacy MCP smoke with dummy credentials.
2. **Cloudflare deployment:** CLI completion, latest version at 100%, correct container application/image, binding metadata showing Secret types.
3. **Public protocol:** `npm run smoke` verifies discovery, S256/issuer metadata, and rejection of anonymous/forged MCP calls. A blocked execution proxy does not establish a Worker failure.
4. **Real owner sign-in:** ChatGPT consent → GitHub OAuth → owner callback → successful connection.
5. **Real tool discovery/data access:** Refresh tools, then Try in chat. Confirm a visible app/tool invocation. Fetch the athlete profile or a few recent activities and compare with intervals.icu. A plausible prose answer alone is not evidence of a call.
6. **Real non-owner denial:** in a separate browser profile/incognito, start a fresh connection while signed into a different GitHub account. Consent may display, but the callback must deny access and issue no MCP authorization code/tokens to that account. Preserve the primary owner's existing connection. Use only accounts you are authorized to test. Automated stub-identity denial is not this browser acceptance check.

Owner connection, tool refresh, and a real data query have been confirmed for the deployed instance. The real second-account test remains outstanding; do not mark it complete without observing it.

## Routine deployment

Use ignored private settings and the selected account. Rebuild, dry-run, then deploy from reviewed source. Deploy without a secrets file or secret environment variables to preserve saved dashboard secrets. Preview URLs and Worker observability remain disabled. Never log request URLs, headers, bodies, OAuth codes, cookies, tokens, or health-data responses.

Stateless Streamable HTTP needs no in-memory MCP session ID. The single owner container sleeps after ten minutes of Durable Object inactivity. A restart or rollout can still interrupt an in-flight tool call; the gateway never replays it. Retry deliberately only after understanding the failure. When the client UI's discovery fails, diagnose the protocol exchange rather than repeatedly reauthorizing GitHub.

## Emergency access invalidation

Change `authEpoch` in private settings to a new non-empty value, rebuild, and redeploy. Old owner grants fail both MCP access checks and refresh. Changing the allowed numeric owner ID also rejects previous grants. Configuration edits do nothing until deployed. In-flight requests may finish.

Deleting the GitHub OAuth App alone does not revoke existing Worker-issued MCP tokens. OAuth KV contains application authorization state; do not delete its namespace as routine troubleshooting. Provider replay protections depend on KV's eventual-consistency model.

## Rotate credentials

- Rotate the GitHub OAuth App client secret or intervals.icu API key at its issuing service.
- Save both runtime values through the secure deployment mechanism or update the intended dashboard Secret entries.
- Restart/redeploy the container so a changed intervals.icu key reaches the process. The current image-replacement check alone does not restart an unchanged image just because a secret was edited; explicitly stop the owner container through the dashboard if needed.
- Change `authEpoch` and redeploy when grants should also be invalidated.
- Verify a real read call afterward. Do not request secret values from the deployed Worker, paste them into chat, or put them into a shell command's arguments.

## Rollback and upgrades

Before deploying, record the source commit, Worker version, and container digest in a private operations record. Cloudflare can roll back a Worker version, but under `durable_object` scheduling a running container keeps its image until application code stops it. The gateway compares the configured image on the next authorized request and replaces an older image. Verify the selected image and secrets separately after rollback.

Reverting to a stateful image can break current ChatGPT discovery even if discovery returns HTTP 200. Keep the header and stateless compatibility fixes together. Do not roll back `authEpoch` to restore previously revoked grants inadvertently.

When updating upstream:

1. Review the new ICU Visor commit, its go.mod/Go version, transport behavior, and read-only registration.
2. Update the full pin; inspect or remove the local one-line patch only if the upstream CLI now supports the required options.
3. Keep `git apply --check` fail-closed. Do not silently ignore a failed patch.
4. Run current-protocol discovery/tool listing **and** legacy initialization against the actual new image with a dummy key.
5. Run all OAuth and browser tests, preflight, full build, and dry run before deploying.
6. Confirm the 22-tool default expectation or deliberately review a changed catalog; every exposed tool must remain read-only.

## Costs and resource cleanup

Workers Paid plus applicable Containers CPU/memory/disk/egress, KV, and Durable Object usage are billable. Consult [current Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/). Single-owner routing, a lite instance, and idle sleep reduce usage but are not a hard spending cap. The scheduling policy does not support `max_instances`.

Review Cloudflare usage/billing periodically. Remove only known unused images/versions and retired applications after checking rollback requirements. Never delete OAuth KV or a Durable Object namespace merely to clear an HTTP error. The initial placeholder was replaced by the full gateway; there is no separate placeholder application to maintain.

Temporary diagnostic code and its records have been removed. Local `work/` can contain CLI/Docker credentials; keep it mode-restricted and out of archives, Git, and support bundles. At the end of an execution environment's useful life, revoke or log out its credential sessions using the provider's supported controls.

## Public repository and CI

Only placeholder configuration belongs in Git. The container build context admits the Dockerfile and the reviewed patch, not local settings or secrets. `.dev.vars.example` is a template; `.dev.vars` is private. Scan both the publishable tree and Git history before release, with redacted findings. Absence of scanner findings is not a guarantee against every possible secret format.

The initial feature history included non-secret deployment identifiers and a personal author email. The owner authorized a handoff rewrite to replace known identifiers and use a GitHub noreply address. Reachable history is rescanned before publication. Rewriting Git refs cannot erase existing clones or every hosting cache; coordinate any further purge with the hosting provider. Do not force-push published history without explicit authorization.

Main/PR CI is non-deploying. Manual production GitHub Actions deployment requires the configured environment secrets and optional reviewer controls; merging alone does not provision or deploy.
