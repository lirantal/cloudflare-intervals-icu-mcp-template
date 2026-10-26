import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const image=process.argv[2] || 'example-account-icuvisor:test';
const name='icuvisor-smoke-'+randomUUID();
const docker=(args)=>{const r=spawnSync('docker',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||'Docker command failed');return r.stdout.trim();};
const parse=async r=>{assert.ok(r.ok,`MCP HTTP ${r.status}: ${await r.clone().text()}`);const text=await r.text();if(r.headers.get('content-type')?.includes('text/event-stream'))return JSON.parse(text.split('\n').find(l=>l.startsWith('data:'))?.slice(5)||'null');return JSON.parse(text);};
try{
  docker(['run','--detach','--rm','--name',name,'--publish','127.0.0.1::8080',
    '--env','INTERVALS_ICU_API_KEY=smoke-dummy-no-real-access', '--env','INTERVALS_ICU_ATHLETE_ID=i12345',
    '--env','ICUVISOR_DELETE_MODE=none',image]);
  const port=docker(['port',name,'8080/tcp']).split(':').at(-1);
  const endpoint=`http://127.0.0.1:${port}/mcp`;
  const headers={'content-type':'application/json',accept:'application/json, text/event-stream'};
  const post=(body)=>fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  let initialized;
  for(let attempt=0;attempt<30;attempt++){
    try{initialized=await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'container-smoke',version:'1'}}});break;}
    catch{await new Promise(r=>setTimeout(r,200));}
  }
  assert.ok(initialized,'Container did not start');
  const session=initialized.headers.get('mcp-session-id');if(session)headers['mcp-session-id']=session;
  const init=await parse(initialized);assert.ok(init.result?.serverInfo);
  headers['mcp-protocol-version']=init.result.protocolVersion;
  const notification=await post({jsonrpc:'2.0',method:'notifications/initialized'});assert.ok(notification.ok);
  const list=await parse(await post({jsonrpc:'2.0',id:2,method:'tools/list'}));
  assert.ok(list.result?.tools?.length>0,'No tools discovered');
  for(const tool of list.result.tools)assert.equal(tool.annotations?.readOnlyHint,true,`${tool.name} is not annotated read-only`);
  console.log(`Container initialized and listed ${list.result.tools.length} read-only tools with a dummy API key; no intervals.icu API calls made.`);
}finally{spawnSync('docker',['rm','--force',name],{stdio:'ignore'});}
