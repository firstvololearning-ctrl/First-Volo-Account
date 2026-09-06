const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/deletion-request.js'),'utf8');
class Element {constructor(){this.hidden=true;this.children=[];this.listeners={};this.value='';this.disabled=false;this.textContent='';}get options(){return this.children;}append(...x){this.children.push(...x);}replaceChildren(){this.children=[];}addEventListener(n,f){this.listeners[n]=f;}}
async function setup({user={id:'owner',email:'adult@example.invalid'},students=[{id:'s',display_name:'<img onerror=bad>'}],requests=[],queryError=false,rpcError=false,rpcHook,queryHook}={}){
 let auth; const nodes={},calls=[],scopes=[];const get=id=>nodes[id]??=new Element();
 const client={auth:{getUser:async()=>({data:{user}}),onAuthStateChange:f=>{auth=f;}},from:table=>{const q={select:()=>q,eq:(k,v)=>{scopes.push([k,v]);return q;},order:()=>q,range:async(a,b)=>{if(queryHook)queryHook(auth);return {data:(table==='students'?students:requests).slice(a,b+1),error:queryError?Error():null};}};return q;},rpc:async(name,args)=>{calls.push({name,args});if(rpcHook)await rpcHook(auth);return {data:true,error:rpcError?Error():null};}};
 await vm.runInNewContext(source,{window:{FirstVoloAccountSupabase:{client}},document:{getElementById:get,createElement:()=>new Element()},Date,Map,Set});
 return {get,calls,scopes,auth:(...x)=>auth(...x),submit:()=>get('deletionForm').listeners.submit({preventDefault(){}})};
}
(async()=>{
 for(const user of [null,{id:'s',is_anonymous:true}]){const t=await setup({user});assert.equal(t.get('signedIn').hidden,true);assert.equal(t.calls.length,0);}
 let t=await setup();assert.equal(t.get('signedIn').hidden,false);assert.equal(t.get('learner').children[1].textContent,'<img onerror=bad>');assert(t.scopes.every(x=>x[1]==='owner'));
 await t.submit();assert.equal(t.calls.length,0);t.get('learner').value='s';t.get('confirmation').value='DELETE';await t.submit();assert.equal(t.calls[0].name,'request_student_deletion');assert.equal(t.calls[0].args.p_student_id,'s');assert.equal('p_owner_user_id' in t.calls[0].args,false);
 const req={id:'r',student_id:'s',status:'pending',requested_at:new Date().toISOString(),delete_after:new Date(Date.now()+86400000).toISOString()};
 t=await setup({requests:[req]});assert.equal(t.get('learner').children.length,1);let cancel=t.get('history').children[0].children[0];await cancel.listeners.click();assert.equal(t.calls[0].name,'cancel_student_deletion');
 t=await setup({requests:[{...req,delete_after:'2000-01-01'}]});assert.equal(t.get('history').children[0].children.length,0);assert.match(t.get('history').children[0].textContent,/Awaiting/);
 t=await setup({requests:[req]});cancel=t.get('history').children[0].children[0];t.auth('SIGNED_OUT',null);await cancel.listeners.click();assert.equal(t.calls.length,0);assert.equal(t.get('history').children.length,0);
 t=await setup({queryHook:f=>f('SIGNED_OUT',null)});assert.equal(t.get('signedIn').hidden,true);
 t=await setup({rpcHook:f=>f('SIGNED_OUT',null)});t.get('learner').value='s';t.get('confirmation').value='DELETE';await t.submit();assert.equal(t.get('message').textContent,'');assert.equal(t.get('history').children.length,0);
 t=await setup({queryError:true});assert.equal(t.get('signedIn').hidden,true);
 t=await setup({rpcError:true});t.get('learner').value='s';t.get('confirmation').value='DELETE';await t.submit();assert.match(t.get('message').textContent,/could not be confirmed/);assert.equal(t.get('submitDeletion').disabled,false);
 t=await setup({students:Array.from({length:101},(_,i)=>({id:String(i),display_name:'Owl '+i}))});assert.equal(t.get('learner').children.length,102);
 console.log('PASS: authentication gating, exact learner selection/confirmation, owner scoping, safe label rendering, request/cancel RPCs, expired deadline, pagination, failure recovery, and stale-session clearing. Mocked DOM and backend.');
})().catch(e=>{console.error(e);process.exitCode=1;});
