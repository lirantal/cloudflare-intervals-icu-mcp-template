import type { Env, Props } from './env';
import { isOwner } from './policy';
async function forwardMcp(request: Request, env: Env, props: Props): Promise<Response> {
  if (!isOwner(props, env)) return new Response('Forbidden', { status: 403 });
  const u = new URL(request.url);
  if (u.pathname !== '/mcp' || u.search) return new Response('Not found', { status: 404 });
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return new Response('Method not allowed', {status:405,headers:{Allow:'GET, POST, DELETE'}});
  const origin = request.headers.get('origin');
  if (origin && origin !== env.PUBLIC_ORIGIN && origin !== 'https://chatgpt.com') return new Response('Forbidden origin', {status:403});
  // Build an allowlist: credentials, cookies and spoofed forwarding headers never reach Go.
  const headers = new Headers();
  for (const name of ['content-type', 'accept', 'mcp-session-id', 'mcp-protocol-version', 'mcp-method', 'mcp-name', 'last-event-id']) {
    const v = request.headers.get(name); if (v) headers.set(name, v);
  }
  // Standard schema-annotated MCP parameter headers are protocol metadata,
  // just like Mcp-Method/Mcp-Name. Do not forward arbitrary mcp-* headers.
  for (const [name, value] of request.headers) {
    if (/^mcp-param-[a-z0-9-]+$/.test(name)) headers.set(name, value);
  }
  // The Go SDK protects loopback hosts against DNS rebinding. The internal target is fixed.
  const upstream = new Request('http://localhost:8080/mcp', {
    method: request.method, headers,
    body: request.body, redirect: 'manual', signal: request.signal,
  });
  try {
    const response = await env.MCP_CONTAINER.getByName('owner').fetch(upstream);
    const output = new Headers(response.headers);
    output.set('Cache-Control', 'no-store');
    // Do not follow or relay an unexpected backend redirect.
    if (response.status >= 300 && response.status < 400) return new Response('Unexpected backend redirect', {status:502});
    return new Response(response.body, {status:response.status, headers:output});
  } catch (error) {
    // Never retry a tool call here: an interrupted write may already have completed.
    return new Response('MCP container unavailable; reconnect if its session expired', {status:503,headers:{'Retry-After':'5', 'X-MCP-Failure': error instanceof Error && /^MCP_CONTAINER_(image|inspect|start|timeout|readiness)$/.test(error.message) ? error.message : 'MCP_CONTAINER_forward'}});
  }
}

// Temporary, explicitly time-limited diagnostics. Never store URLs, identifiers,
// request/response bodies, token/cookie/header values, or tool arguments.
export async function proxyMcp(request: Request, env: Env, props: Props): Promise<Response> {
  if (!isOwner(props, env) || !(Date.now() < Number(env.MCP_DIAGNOSTICS_UNTIL))) return forwardMcp(request,env,props);
  let method = request.method === 'GET' ? 'stream' : 'other';
  let shape = 'no-json';
  let batchSize = 0;
  let batchMethods: string[] = [];
  let protocolVersion = 'unspecified';
  if(request.method === 'POST') {
    try {
      const body = await request.clone().json() as {method?:string};
      const known = ['server/discover','initialize','notifications/initialized','tools/list','ping','resources/list','prompts/list'];
      shape = Array.isArray(body) ? 'batch' : body && typeof body === 'object' ? 'object' : 'scalar';
      const entries = Array.isArray(body) ? body : [body];
      batchSize = Array.isArray(body) ? body.length : 0;
      batchMethods = entries.slice(0,10).map(entry => known.includes(entry?.method) ? entry.method : 'other');
      const version = entries.find(entry=>entry?.method==='initialize')?.params?.protocolVersion ?? entries[0]?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
      if(['2024-11-05','2025-03-26','2025-06-18','2025-11-25','2026-07-28'].includes(version)) protocolVersion=version;
      if(known.includes(body.method ?? '')) method=body.method!;
    } catch { /* malformed MCP is handled by the backend */ }
  }
  const key='diagnostic:mcp:'+method.replaceAll('/','-');
  const write=async(value:Record<string,unknown>)=>{
    try {await env.OAUTH_KV.put(key,JSON.stringify(value),{expirationTtl:600});} catch { /* diagnostic failures must not fail MCP */ }
  };
  const start=Date.now();
  await write({method,shape,batchSize,batchMethods,protocolVersion,phase:'forwarding',at:new Date().toISOString()});
  let response:Response;
  try {response=await forwardMcp(request,env,props);} catch {response=new Response('MCP proxy unavailable',{status:503,headers:{'X-MCP-Failure':'MCP_PROXY_request'}});}
  const contentType=response.headers.get('content-type')??'';
  const mediaType=contentType.includes('text/event-stream')?'sse':contentType.includes('application/json')?'json':'other';
  await write({method,shape,batchSize,batchMethods,protocolVersion,phase:'response',at:new Date().toISOString(),status:response.status,mediaType,
    hasSession:response.headers.has('mcp-session-id'),elapsedMs:Date.now()-start,
    failure:response.headers.get('X-MCP-Failure')??null});
  return response;
}
