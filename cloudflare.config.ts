import { bindings, defineConfig, defineContainer, exports } from 'cf/config';
import settings from './deployment.json' with { type: 'json' };

const container = defineContainer({
  name: `${settings.workerName}-server`,
  image: { dockerfile: './Dockerfile' },
  instanceType: 'lite',
  maxInstances: 1,
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
      MCP_CONTAINER: bindings.durableObject({ worker: settings.workerName, exportName: 'IcuvisorContainer' }),
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
