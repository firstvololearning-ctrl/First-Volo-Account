(()=>{'use strict';
 const endpoint='https://apkvvspubolyxlqtlkto.supabase.co/functions/v1/consent-setup-workflow';
 const params=new URLSearchParams(location.hash.slice(1));
 const caseId=params.get('case'),token=params.get('token');
 // Remove the secret from the visible URL/history entry; keep it only in this page's memory.
 history.replaceState(null,'',location.pathname);
 const status=document.getElementById('status'),notice=document.getElementById('notice'),form=document.getElementById('response'),check=document.getElementById('agreement'),agree=document.getElementById('agree'),decline=document.getElementById('decline');
 let version;
 async function call(action){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,caseId,token,noticeVersion:version,agrees:check.checked}),credentials:'omit',referrerPolicy:'no-referrer'});const data=await r.json();if(!r.ok)throw new Error('unavailable');return data;}
 check.addEventListener('change',()=>agree.disabled=!check.checked);
 async function submit(action){agree.disabled=true;decline.disabled=true;status.textContent='Recording your test response…';try{const data=await call(action);form.hidden=true;status.textContent=action==='decline'?'Test invitation declined. No student access was activated.':data.confirmation==='accepted'?'Test response recorded. The confirmation email was accepted by the mail server. No student access was activated.':'Test response recorded. Confirmation delivery needs review. No student access was activated.';}catch{form.hidden=true;status.textContent='We could not confirm the result. Please contact us rather than submitting again.';}}
 form.addEventListener('submit',e=>{e.preventDefault();if(check.checked)submit('consent');});decline.addEventListener('click',()=>submit('decline'));
 if(!caseId||!token){status.textContent='Please open the complete link from your test invitation email.';return;}
 call('view').then(data=>{version=data.noticeVersion;notice.textContent=data.noticeText;form.hidden=data.state!=='pending';status.textContent=data.state==='pending'?'Read the notice below before choosing. Opening this page does not record an agreement.':'This invitation already has a response. No student access was activated.';}).catch(()=>{status.textContent='This invitation is unavailable or has expired. Please contact us for help.';});
})();
