import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const chromium = process.env.CHROMIUM_BIN || ['chromium', 'chromium-browser', 'google-chrome'].find(bin => spawnSync('which',[bin]).status===0);

if (process.env.REQUIRE_BROWSER_TESTS === 'true' && !chromium) throw new Error('Install Chromium/Chrome or set CHROMIUM_BIN; browser tests are required');

// Loopback bridge to the real workerd fixture. Only the test origin is translated;
// GitHub/ChatGPT navigations are intercepted by CDP and never reach the Internet.
export async function browserConsent(
  dispatch: (path: string, init?: RequestInit) => Promise<any>,
  authorizationPath: string,
  decision: 'approve' | 'deny',
): Promise<{ destination: string; violations: string[] }> {
  if (!chromium) throw new Error('Chromium is required for browser consent validation');
  const directory=await mkdtemp(join(tmpdir(),'icuvisor-browser-'));
  let localOrigin='';
  const server=http.createServer(async(req,res)=>{
    try {
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers)) if(value && key!=='host') headers.set(key,Array.isArray(value)?value.join(', '):value);
      if(headers.get('origin')===localOrigin) headers.set('origin','https://owner.example');
      const chunks:Buffer[]=[];for await(const chunk of req) chunks.push(Buffer.from(chunk));
      const response=await dispatch(req.url!,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})} as RequestInit);
      res.statusCode=response.status;
      for(const [key,value] of response.headers) if(!['set-cookie','content-length','transfer-encoding','content-encoding'].includes(key)) res.setHeader(key,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {res.statusCode=500;res.end('Test bridge failed');}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  localOrigin=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const child=spawn(chromium,['--headless','--no-sandbox','--disable-background-networking','--disable-dev-shm-usage','--no-first-run','--disable-extensions',`--user-data-dir=${directory}`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe']});
  let socket:WebSocket|undefined;
  try {
    const endpoint=await new Promise<string>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Chromium did not start')),10000);
      child.on('error',reject);
      child.stderr.on('data',data=>{const match=String(data).match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    socket=new WebSocket(endpoint);await new Promise<void>((resolve,reject)=>{socket!.addEventListener('open',()=>resolve(),{once:true});socket!.addEventListener('error',()=>reject(Error('CDP connection failed')),{once:true});});
    let id=0;
    const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
    const violations:string[]=[];
    let reached!:(destination:string)=>void;
    const destination=new Promise<string>(resolve=>{reached=resolve;});
    const send=(method:string,params:object={},sessionId?:string):Promise<any>=>new Promise((resolve,reject)=>{
      const requestId=++id;pending.set(requestId,{resolve,reject});socket!.send(JSON.stringify({id:requestId,method,params,...(sessionId?{sessionId}:{})}));
    });
    socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if(message.id){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(message.error.message));else task?.resolve(message.result);return;}
      if(message.method==='Log.entryAdded') violations.push(message.params.entry.text);
      if(message.method==='Fetch.requestPaused') {
        const url=new URL(message.params.request.url);
        if(url.origin==='https://github.com'||url.origin==='https://chatgpt.com') {
          void send('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'text/html'}],body:Buffer.from('Mock identity/callback destination').toString('base64')},message.sessionId).then(()=>reached(url.origin));
        } else void send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'BlockedByClient'},message.sessionId);
      }
    });
    const target=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await send('Page.enable',{},sessionId);await send('Log.enable',{},sessionId);
    await send('Fetch.enable',{patterns:[{urlPattern:'https://*'}]},sessionId);
    await send('Page.navigate',{url:localOrigin+authorizationPath},sessionId);
    const deadline=Date.now()+5000;
    for(;;){const state=await send('Runtime.evaluate',{expression:'!!document.querySelector("button[name=decision]")',returnByValue:true},sessionId);if(state.result?.value)break;if(Date.now()>deadline)throw Error('Consent form did not render');await new Promise(r=>setTimeout(r,50));}
    await send('Runtime.evaluate',{expression:`document.querySelector('button[value="${decision}"]').click()`},sessionId);
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const result=await Promise.race([destination,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser redirect blocked: '+violations.join('; '))),5000);})]);
      return {destination:result,violations};
    } finally {clearTimeout(timer);}
  } finally {
    socket?.close();child.kill('SIGTERM');
    await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else {child.once('exit',()=>resolve());setTimeout(()=>{child.kill('SIGKILL');resolve();},1000).unref();}});
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
    await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}
