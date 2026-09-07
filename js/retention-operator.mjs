export function evidenceArgs(notice, values) {
 if(!notice || notice.isTest || notice.staged || notice.status!=='accepted') throw Error('Choose an accepted real notice that has not been recorded.');
 const delivered=new Date(values.delivered),available=new Date(values.available);
 if(!Number.isFinite(+delivered)||!Number.isFinite(+available)||+delivered<Date.parse(notice.sentAt)||+delivered>=Date.parse(notice.accessEnds)||+delivered>Date.now()||+available>Date.parse(notice.sentAt)) throw Error('Check the dates: the download must be available when sent and delivery must precede access ending.');
 const delivery=values.delivery.trim(),download=values.download.trim();
 if(!values.checked||delivery.length<5||download.length<5||delivery.length>500||download.length>500) throw Error('Confirm the completed checks and enter both evidence references.');
 return {p_notice:notice.id,p_delivered_at:delivered.toISOString(),p_export_at:available.toISOString(),p_delivery_reference:delivery,p_export_reference:download};
}
export function startRetentionOperator(doc,client) {
 const by=id=>doc.getElementById(id);let notices=[],epoch=0,busy=false;
 function clear(){epoch++;notices=[];by('notice').replaceChildren();by('evidence').reset();by('save').disabled=true;by('details').textContent='';}
 client?.auth.onAuthStateChange((event,session)=>{if(!session){clear();by('status').textContent='Sign in to your operator account.';}});
 by('refresh').onclick=async()=>{if(busy)return;clear();busy=true;const e=epoch;try{
 const {data,error}=await client.rpc('list_operator_retention_notices');if(error||!Array.isArray(data))throw Error();if(e!==epoch)return;notices=data;
 for(const n of notices){const option=doc.createElement('option');option.value=n.id;option.textContent=`${n.isTest?'Test':n.product} — ${n.recipient} — ${n.staged?'Evidence recorded':n.status}`;option.disabled=n.isTest||n.staged||n.status!=='accepted';by('notice').append(option);}
 by('notice').value='';by('status').textContent=notices.length?'Choose a real notice to record completed checks. Test messages cannot start retention.':'No notices to review.';
 }catch{if(e===epoch)by('status').textContent='Could not load notices. Check your current operator sign-in.';}finally{busy=false;}};
 by('notice').onchange=()=>{const n=notices.find(n=>n.id===by('notice').value);by('save').disabled=!n||n.isTest||n.staged||n.status!=='accepted';by('details').textContent=n?`Sent: ${n.sentAt||'not sent'}. Access ends: ${n.accessEnds||'not applicable'}.` : '';};
 by('evidence').onsubmit=async event=>{event.preventDefault();if(busy)return;let args;try{args=evidenceArgs(notices.find(n=>n.id===by('notice').value),{delivered:by('delivered').value,available:by('available').value,delivery:by('delivery').value,download:by('download').value,checked:by('checked').checked});}catch(e){by('status').textContent=e.message;return;}
 busy=true;by('save').disabled=true;const e=epoch;try{const {data,error}=await client.rpc('record_operator_retention_evidence',args);if(error||data?.status!=='held'||data.deletionEnabledByThisAction!==false)throw Error();if(e!==epoch)return;clear();by('status').textContent='Evidence recorded. The retention case is on hold. No email was sent and no deletion was enabled. Refresh to review notices.';}catch{if(e===epoch)by('status').textContent='Not confirmed. Refresh before retrying; the notice may already be recorded or its eligibility may have changed.';}finally{busy=false;}}
}
