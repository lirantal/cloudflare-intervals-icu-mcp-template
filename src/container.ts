import { Container } from '@cloudflare/containers';
import type { Env } from './env';
export class IcuvisorContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '10m';
  enableInternet = true;
  envVars = {
    INTERVALS_ICU_API_KEY: this.env.INTERVALS_ICU_API_KEY,
    INTERVALS_ICU_ATHLETE_ID: this.env.INTERVALS_ICU_ATHLETE_ID,
    ICUVISOR_TIMEZONE: this.env.ICUVISOR_TIMEZONE,
    ICUVISOR_DELETE_MODE: this.env.ICUVISOR_DELETE_MODE,
    ICUVISOR_TOOLSET: this.env.ICUVISOR_TOOLSET,
    ICUVISOR_COACH_MODE: 'off',
  };
}
