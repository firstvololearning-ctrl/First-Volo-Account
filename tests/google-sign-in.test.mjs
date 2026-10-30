import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const authSource=fs.readFileSync(new URL('../js/auth-session.js',import.meta.url),'utf8');
const returnSource=fs.readFileSync(new URL('../js/auth-return-targets.js',import.meta.url),'utf8');
function harness({key='',hash='',queryError='',session={user:{id:'fictional-educator'}},oauthError=null}={}){
 const calls=[],navigation=[],message={textContent:''},link={hidden:true};
 const search=new URLSearchParams();if(key)search.set('returnTo',key);if(queryError)search.set('error',queryError);
 const location={href:'https://firstvololearning-ctrl.github.io/First-Volo-Account/index.html?'+search,origin:'https://firstvololearning-ctrl.github.io',hostname:'firstvololearning-ctrl.github.io',search:'?'+search,hash,replace:url=>navigation.push(url)};
 const auth={onAuthStateChange(){},signInWithOAuth:async arg=>{calls.push(JSON.parse(JSON.stringify(arg)));return{error:oauthError};},getSession:async()=>{calls.push('getSession');return{data:{session},error:null};},signOut:async()=>({})};
 const window={location,FirstVoloAccountSupabase:{client:{auth}},dispatchEvent(){}};
 const context={window,URL,URLSearchParams,document:{getElementById:()=>message,querySelector:()=>link},CustomEvent:class{}};
 vm.runInNewContext(returnSource,context);vm.runInNewContext(authSource,context);
 return{auth:window.FirstVoloAccountAuth,calls,navigation,message,link};
}
for(const key of ['storyBuilder','morphology','primoVolo'])test('Google callback preserves allowed '+key+' return target',async()=>{
 const h=harness({key});await h.auth.signInWithGoogle();const call=h.calls[0];assert.equal(call.provider,'google');assert.equal(new URL(call.options.redirectTo).pathname,'/First-Volo-Account/auth-callback.html');assert.equal(new URL(call.options.redirectTo).searchParams.get('returnTo'),key);assert.equal(call.options.queryParams.prompt,'select_account');assert.equal(call.options.scopes,undefined);
 await h.auth.completeRedirect();assert.match(h.navigation[0],/^https:\/\/firstvololearning-ctrl\.github\.io\//);
});
test('unrecognized return URL is discarded for OAuth and successful completion',async()=>{const h=harness({key:'https://untrusted.example/'});await h.auth.signInWithGoogle();assert.equal(new URL(h.calls[0].options.redirectTo).search,'');await h.auth.completeRedirect();assert.deepEqual(h.navigation,['index.html']);});
for(const params of [{hash:'#error=access_denied&error_description=private-test-detail'},{queryError:'access_denied'}])test('cancelled OAuth exposes a return link without reflecting provider details',async()=>{const h=harness(params);await h.auth.completeRedirect();assert.equal(h.link.hidden,false);assert.deepEqual(h.navigation,[]);assert.equal(h.calls.length,0);assert.doesNotMatch(h.message.textContent,/private-test-detail|access_denied/);});
test('callback without a session does not navigate',async()=>{const h=harness({session:null});await h.auth.completeRedirect();assert.equal(h.link.hidden,false);assert.deepEqual(h.navigation,[]);});
test('provider error is returned to the caller without changing session or navigation',async()=>{const error={message:'fixture-provider-error'};const h=harness({oauthError:error});assert.equal((await h.auth.signInWithGoogle()).error,error);assert.deepEqual(h.navigation,[]);assert.equal(h.calls.length,1);});
test('Google UI failure is retryable and does not expose backend errors',async()=>{
 const source=fs.readFileSync(new URL('../js/account-ui.js',import.meta.url),'utf8');const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}});return nodes.get(id);};
 let attempts=0;const window={FirstVoloAccountAuth:{signInWithGoogle:async()=>{attempts++;throw Error('private backend detail');},handleSessionError:async()=>false},FirstVoloAccountData:{getAccountSnapshot:async()=>({user:null})},FirstVoloAccountReturnTargets:{requestedKey:()=>null},location:{replace(){}}};
 vm.runInNewContext(source,{window,document:{getElementById:node},console});await new Promise(resolve=>setImmediate(resolve));
 await node('googleSignInButton').handlers.click();assert.equal(attempts,1);assert.equal(node('googleSignInButton').disabled,false);assert.match(node('googleSignInMessage').textContent,/try again/);assert.doesNotMatch(node('googleSignInMessage').textContent,/private backend/);
});
