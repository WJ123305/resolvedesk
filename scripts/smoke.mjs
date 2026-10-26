// Run only against a local demo instance. Creates one clearly labelled smoke-test ticket.
import assert from 'node:assert/strict';
const base=process.env.RESOLVEDESK_URL||'http://127.0.0.1:8080';
const url=new URL(base);
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('Smoke checks are restricted to a local demo instance.');
const jar=new Map();let csrf;
async function request(path,method='GET',body){
 const headers={Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')};
 if(method!=='GET'&&csrf) headers[csrf.headerName]=csrf.token;
 if(body) headers['Content-Type']=body instanceof URLSearchParams?'application/x-www-form-urlencoded':'application/json';
 const r=await fetch(base+'/api'+path,{method,headers,body:body instanceof URLSearchParams?body:body?JSON.stringify(body):undefined});
 for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 const data=r.status===204?null:await r.json();
 return {status:r.status,data};
}
assert.equal((await request('/health')).status,200);
assert.equal((await request('/tickets')).status,401);
csrf=(await request('/csrf')).data;
assert.equal((await request('/login','POST',new URLSearchParams({username:'admin@acme.demo',password:'Demo@12345'}))).status,200);
csrf=(await request('/csrf')).data;
assert.equal((await request('/me')).data.tenantName,'拾光科技');
const q='SMOKE: packaged runtime';
let ticket=(await request('/tickets?q='+encodeURIComponent(q))).data.items[0];
if(process.argv.includes('--verify-persistence')){
 assert.ok(ticket,'The smoke ticket must survive application restart.');
 assert.equal(ticket.status,'RESOLVED');
 assert.ok((await request('/tickets/'+ticket.id)).data.comments.some(c=>c.body==='Smoke check: saved reply.'));
 console.log('PASS: packaged runtime persisted ticket, status and reply across restart.');
}else{
 const created=await request('/tickets','POST',{title:q,description:'Local smoke test for creation, status, conflict and restart persistence.',priority:'LOW'});
 assert.equal(created.status,201);ticket=created.data;
 const move=await request(`/tickets/${ticket.id}/status`,'PATCH',{status:'IN_PROGRESS',version:ticket.version});assert.equal(move.status,200);ticket=move.data;
 assert.equal((await request(`/tickets/${ticket.id}/status`,'PATCH',{status:'RESOLVED',version:0})).status,409);
 const reply=await request(`/tickets/${ticket.id}/comments`,'POST',{body:'Smoke check: saved reply.',version:ticket.version});assert.equal(reply.status,200);ticket=reply.data;
 assert.equal((await request(`/tickets/${ticket.id}/status`,'PATCH',{status:'RESOLVED',version:ticket.version})).status,200);
 const html=await fetch(base+'/');assert.equal(html.status,200);assert.match(await html.text(),/ResolveDesk/);
 console.log('PASS: packaged UI, authentication, create, state transition, reply and stale-version conflict.');
}
assert.equal((await request('/logout','POST')).status,204);
assert.equal((await request('/tickets')).status,401);
console.log('PASS: logout invalidates session.');
