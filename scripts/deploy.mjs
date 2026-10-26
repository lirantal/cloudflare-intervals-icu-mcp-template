import { spawnSync } from 'node:child_process';
import { mkdir,mkdtemp,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
const preflight=spawnSync(process.execPath,['scripts/preflight.mjs'],{stdio:'inherit'});
if(preflight.status!==0)process.exit(preflight.status??1);
let temporary;
try{
  const args=['deploy',...process.argv.slice(2)];
  const names=['GITHUB_CLIENT_SECRET','INTERVALS_ICU_API_KEY'];
  const supplied=names.filter(n=>process.env[n]);
  if(supplied.length && supplied.length!==names.length)throw Error('Provide both runtime secrets together, or neither to preserve deployed secrets');
  if(supplied.length){
    await mkdir('work',{recursive:true});
    temporary=await mkdtemp('work/deploy-');
    const file=path.resolve(temporary,'secrets.json');
    await writeFile(file,JSON.stringify(Object.fromEntries(names.map(n=>[n,process.env[n]]))),{mode:0o600});
    args.push('--secrets-file',file);
  }
  const childEnv={...process.env};
  for(const n of names)delete childEnv[n];
  const result=spawnSync(process.execPath,['node_modules/cf/bin/cf',...args],{stdio:'inherit',env:childEnv});
  process.exitCode=result.status??1;
}finally{if(temporary)await rm(temporary,{recursive:true,force:true});}
