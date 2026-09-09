import test from 'node:test';
import assert from 'node:assert/strict';
import {startOperatorDelivery} from '../js/parent-delivery-operator.mjs';
function fixture({delay=false}={}) {
 const ids=['request','recipient','evidence','authority','code','preview','packet','finish','complete','prepare','status','response','handoff','delivered','clear'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',checked:false,disabled:true,listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},reset(){nodes.delivered.checked=false;nodes.response.value='';nodes.handoff.value='';}}]));
 nodes.authority.checked=true; nodes.request.value='11111111-1111-1111-1111-111111111111'; nodes.recipient.value='fictional@example.com';nodes.evidence.value='verified-test';
 let authChange,resolveRpc,calls=0; const windowListeners={};
 const document={getElementById:id=>nodes[id],defaultView:{addEventListener:(event,fn)=>{windowListeners[event]=fn;}}};
 const response={data:{status:'prepared_for_operator_review',delivered:false,requestId:'11111111-1111-1111-1111-111111111111',verifiedDeliveryEmail:'fictional@example.com',records:{product:'primo-volo',learningRecords:[]}}};
 const client={auth:{onAuthStateChange(fn){authChange=fn;}},rpc:async()=>{calls++;return delay?await new Promise(resolve=>{resolveRpc=resolve;}):response;}};
 startOperatorDelivery(document,client);
 const change=(id,event='SIGNED_IN')=>authChange(event,id?{user:{id}}:null);
 change('operator-a','INITIAL_SESSION');
 return {nodes,change,windowListeners,prepare:()=>nodes.prepare.onsubmit({preventDefault(){}}),resolve:()=>resolveRpc(response),calls:()=>calls};
}
function cleared(f){assert.equal(f.nodes.code.value,'');assert.equal(f.nodes.preview.textContent,'');assert.equal(f.nodes.packet.disabled,true);assert.equal(f.nodes.finish.disabled,true);}
test('account switch clears prepared records, code and delivery controls',async()=>{const f=fixture();await f.prepare();assert.ok(f.nodes.code.value);f.change('operator-b');cleared(f);});
test('account switch invalidates an in-flight preparation',async()=>{const f=fixture({delay:true});const pending=f.prepare();f.change('operator-b');f.resolve();await pending;cleared(f);});
test('same-account token refresh keeps current preparation',async()=>{const f=fixture();await f.prepare();const code=f.nodes.code.value;f.change('operator-a','TOKEN_REFRESHED');assert.equal(f.nodes.code.value,code);assert.equal(f.nodes.packet.disabled,false);});
test('sign-out clears prepared records',async()=>{const f=fixture();await f.prepare();f.change(null,'SIGNED_OUT');cleared(f);});
test('leaving the page clears prepared records before history caching',async()=>{const f=fixture();await f.prepare();assert.equal(typeof f.windowListeners.pagehide,'function');f.windowListeners.pagehide();cleared(f);});
