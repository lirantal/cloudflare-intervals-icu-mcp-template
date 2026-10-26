import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import type { IcuvisorContainer } from './container';
export interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  MCP_CONTAINER: DurableObjectNamespace<IcuvisorContainer>;
  PUBLIC_ORIGIN: string;
  ALLOWED_GITHUB_USER_ID: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  INTERVALS_ICU_API_KEY: string;
  INTERVALS_ICU_ATHLETE_ID: string;
  ICUVISOR_TIMEZONE: string;
  ICUVISOR_DELETE_MODE: string;
  ICUVISOR_TOOLSET: string;
  AUTH_EPOCH: string;
}
export interface Props { githubUserId: string; authEpoch: string; scope: string[] }
