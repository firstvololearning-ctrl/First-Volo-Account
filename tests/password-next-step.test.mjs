import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/reset-password.js',import.meta.url),'utf8');
async function harness({user={id:'qa'},saveError=null,logoutError=null,throws=false}={}){
 const nodes=new Map();const calls=[];const navigation=[];
 function node(id){if(nodes.has(id))return nodes.get(id);const n={value:'',textContent:'',disabled:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},querySelector(){return node('submit');},set innerHTML(v){this.html=v;for(const m of v.matchAll(/id="([^"]+)"/g))node(m[1]);},get innerHTML(){return this.html||'';}};nodes.set(id,n);return n;}
 const auth={ready:async()=>user,updatePassword:async()=>{calls.push('update');return{error:saveError};},handleSessionError:async()=>false,signOut:async()=>{calls.push('signout');if(throws)throw Error('offline');return{error:logoutError};}};
 vm.runInNewContext(source,{document:{getElementById:node},window:{FirstVoloAccountAuth:auth,location:{replace:url=>navigation.push(url)}}});await new Promise(r=>setImmediate(r));
 const submit=async()=>{node('newPassword').value='test-only-value';node('confirmPassword').value='test-only-value';await node('resetForm').handlers.submit({preventDefault(){},currentTarget:node('resetForm')});};
 return {node,calls,navigation,submit};
}
test('successful reset clears fields and offers a sign-in step that ends the recovery session',async()=>{const h=await harness();await h.submit();assert.equal(h.node('newPassword').value,'');assert.match(h.node('resetContent').innerHTML,/Password updated/);assert.deepEqual(h.calls,['update']);await h.node('resetSignIn').handlers.click();assert.deepEqual(h.calls,['update','signout']);assert.deepEqual(h.navigation,['index.html']);});
test('failed password save never offers success or signs out',async()=>{const h=await harness({saveError:{message:'rejected'}});await h.submit();assert.match(h.node('resetStatus').textContent,/could not be saved/);assert.doesNotMatch(h.node('resetContent').innerHTML,/Password updated/);assert.deepEqual(h.calls,['update']);});
for(const options of [{logoutError:{message:'offline'}},{throws:true}])test('failed sign-out leaves a retryable next step',async()=>{const h=await harness(options);await h.submit();await h.node('resetSignIn').handlers.click();assert.deepEqual(h.navigation,[]);assert.equal(h.node('resetSignIn').disabled,false);assert.match(h.node('resetSignInStatus').textContent,/Please try again/);});
test('expired reset link has a usable account link',async()=>{const h=await harness({user:null});assert.match(h.node('resetContent').innerHTML,/href="index.html"/);assert.deepEqual(h.calls,[]);});
