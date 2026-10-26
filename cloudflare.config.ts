import { bindings, defineConfig, defineContainer, exports } from 'cf/config';
import settings from './deployment.json' with { type: 'json' };

const container = defineContainer({
  name: `${settings.workerName}-server`,
  schedulingPolicy: 'durable-object',
  images: { server: { dockerfile: './Dockerfile' } },
});

export default defineConfig({
  accountId: settings.accountId,
  worker: {
    name: settings.workerName,
    entrypoint: './src/index.ts',
    compatibilityDate: '2026-10-26',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    previewUrls: false,
    observability: { enabled: false },
    exports: { IcuvisorContainer: exports.durableObject({ storage: 'sqlite', container }) },
    env: {
      OAUTH_KV: bindings.kv(),
      // cf beta emits script_name even for same-Worker bindings; its new
      // container validator rejects that. Use native upload metadata until fixed.
      MCP_CONTAINER: { type: 'unsafe:durable_object_namespace', class_name: 'IcuvisorContainer' },
      PUBLIC_ORIGIN: bindings.text(settings.publicOrigin),
      ALLOWED_GITHUB_USER_ID: bindings.text(settings.allowedGithubUserId),
      GITHUB_CLIENT_ID: bindings.text(settings.githubClientId),
      INTERVALS_ICU_ATHLETE_ID: bindings.text(settings.athleteId),
      ICUVISOR_TIMEZONE: bindings.text(settings.timezone),
      ICUVISOR_DELETE_MODE: bindings.text(settings.deleteMode),
      ICUVISOR_TOOLSET: bindings.text(settings.toolset),
      AUTH_EPOCH: bindings.text(settings.authEpoch),
      GITHUB_CLIENT_SECRET: bindings.secret(),
      INTERVALS_ICU_API_KEY: bindings.secret(),
    },
  },
  containers: [container],
});
