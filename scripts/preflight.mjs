import { readFile } from 'node:fs/promises';
const settings=JSON.parse(await readFile(new URL('../deployment.json',import.meta.url),'utf8'));
const errors=[];
if(!/^[a-f0-9]{32}$/.test(settings.accountId))errors.push('accountId must be a Cloudflare account ID');
if(settings.accountId!=='REPLACE')errors.push('accountId differs from the authorized example-account account');
if(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID!==settings.accountId)errors.push('CLOUDFLARE_ACCOUNT_ID would override example-account; remove it or correct it');
if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(settings.workerName))errors.push('invalid workerName');
try{const u=new URL(settings.publicOrigin);if(u.protocol!=='https:' || u.origin!==settings.publicOrigin || /REPLACE/i.test(u.host))throw Error();}catch{errors.push('publicOrigin must be the exact public HTTPS origin, with no trailing slash');}
if(!/^\d+$/.test(settings.allowedGithubUserId))errors.push('set allowedGithubUserId to your numeric GitHub user ID');
if(!settings.githubClientId || settings.githubClientId==='REPLACE')errors.push('set githubClientId to the GitHub OAuth App client ID');
if(!/^i?\d+$/.test(settings.athleteId))errors.push('set athleteId to your intervals.icu athlete ID (i12345 or 12345)');
if(settings.deleteMode!=='none')errors.push('deleteMode must be none: this deployment is read-only');
if(!['compact','core','full'].includes(settings.toolset))errors.push('toolset must be compact, core, or full');
try{new Intl.DateTimeFormat('en',{timeZone:settings.timezone}).format();}catch{errors.push('timezone must be an IANA timezone');}
if(!settings.authEpoch)errors.push('authEpoch must be non-empty');
if(errors.length){console.error('Deployment configuration needs attention:\n'+errors.map(s=>'- '+s).join('\n'));process.exitCode=1;}
else console.log('Configuration valid for example-account; identity and billing still require account verification.');
