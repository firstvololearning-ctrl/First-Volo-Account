import {decryptPacket} from './parent-record-reader.mjs';
export async function encryptReview(result,cryptoApi=globalThis.crypto){
 if(result?.status!=='prepared_for_operator_review'||result.delivered!==false||!result.requestId||!result.records?.product)throw Error('Scoped review required');
 const raw=cryptoApi.getRandomValues(new Uint8Array(32)),iv=cryptoApi.getRandomValues(new Uint8Array(12));
 const key=await cryptoApi.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
 const packet={purpose:'first-volo-parent-review',version:1,requestId:result.requestId,product:result.records.product};
 const plain=new TextEncoder().encode(JSON.stringify(result.records));if(plain.length>10*1024*1024)throw Error('Large report requires separate handling');
 const aad=new TextEncoder().encode(JSON.stringify(packet));
 const data=new Uint8Array(await cryptoApi.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,plain));
 const b64=b=>{let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s);};
 packet.envelope=JSON.stringify({version:1,iv:b64(iv),tag:b64(data.slice(-16)),data:b64(data.slice(0,-16))});
 const code=b64(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 await decryptPacket(packet,code,cryptoApi);
 return {packet,code};
}
export function startOperatorDelivery(document,client){
 const by=id=>document.getElementById(id);let prepared=null,epoch=0,busy=false;
 const clear=()=>{epoch++;prepared=null;by('code').value='';by('preview').textContent='';by('packet').disabled=true;by('finish').disabled=true;by('complete').reset();};
 for(const id of ['request','recipient','evidence','authority'])by(id).addEventListener('input',clear);
 client?.auth.onAuthStateChange((event,session)=>{if(!session){clear();by('status').textContent='Sign in to the operator account.';}});
 by('prepare').onsubmit=async e=>{e.preventDefault();if(busy)return;clear();busy=true;const current=epoch;
 try{if(!client||!by('authority').checked)throw Error();const {data,error}=await client.rpc('prepare_parent_review_delivery',{p_request:by('request').value.trim(),p_verified_email:by('recipient').value.trim(),p_authority_reference:by('evidence').value.trim()});
 if(error||current!==epoch)throw Error();const sealed=await encryptReview(data);if(current!==epoch)return;prepared={...sealed,requestId:data.requestId};by('code').value=sealed.code;by('preview').textContent=JSON.stringify(data.records,null,2);by('packet').disabled=false;by('finish').disabled=false;by('status').textContent=`Prepared for ${data.verifiedDeliveryEmail}. Review the records below. Nothing has been sent; the request remains open.`;
 }catch{if(current===epoch)by('status').textContent='Could not prepare records. Check the request, authority reference and current operator sign-in.';}finally{busy=false;}};
 by('packet').onclick=()=>{if(!prepared)return;const url=URL.createObjectURL(new Blob([JSON.stringify(prepared.packet)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='learning-records.fvlrecords';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 by('complete').onsubmit=async e=>{e.preventDefault();if(!prepared||!by('delivered').checked||busy)return;busy=true;const current=epoch;
 try{const {data,error}=await client.rpc('record_parent_review_delivery',{p_request:prepared.requestId,p_response_reference:by('response').value.trim(),p_delivery_reference:by('handoff').value.trim()});if(error||data?.status!=='completed')throw Error();if(current!==epoch)return;clear();by('status').textContent='Your delivery evidence was recorded and the review request was completed. This action did not send email.';}catch{if(current===epoch)by('status').textContent='Completion could not be recorded. Check the delivery evidence and request status before retrying.';}finally{busy=false;}};
 by('clear').onclick=()=>{clear();by('status').textContent='Prepared records and code cleared from this page. Downloaded copies remain on your device.';};
}
