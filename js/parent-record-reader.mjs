// Local decryption only: no fetch, analytics, storage or network requests.
export async function decryptPacket(packet,code,webcrypto=globalThis.crypto){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(packet?.version!==1||packet.purpose!=='first-volo-parent-review'||!uuid.test(packet.requestId)||!['primo-volo','first-volo-morphology','first-volo-story-builder'].includes(packet.product))throw Error('Invalid records file');
 if(typeof code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(code.trim()))throw Error('Enter the separate access code');
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const raw=bytes(code.trim().replace(/-/g,'+').replace(/_/g,'/')+'=');
 if(typeof packet.envelope!=='string'||packet.envelope.length>16*1024*1024)throw Error('Invalid records file');
 const e=JSON.parse(packet.envelope);
 if(e.version!==1||typeof e.data!=='string'||e.data.length>15*1024*1024)throw Error('Invalid records file');
 const iv=bytes(e.iv),tag=bytes(e.tag),data=bytes(e.data);
 if(iv.length!==12||tag.length!==16||raw.length!==32)throw Error('Invalid records file');
 const combined=new Uint8Array(data.length+tag.length);combined.set(data);combined.set(tag,data.length);
 const key=await webcrypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 const aad=new TextEncoder().encode(JSON.stringify({purpose:packet.purpose,version:1,requestId:packet.requestId,product:packet.product}));
 const plain=await webcrypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},key,combined);
 const report=JSON.parse(new TextDecoder().decode(plain));if(report.product!==packet.product)throw Error('Wrong product');return report;
}
if(typeof document!=='undefined'){
 const form=document.querySelector('form'),status=document.querySelector('#status'),output=document.querySelector('#records'),code=document.querySelector('#code');
 let generation=0;
 form.addEventListener('submit',async e=>{e.preventDefault();const current=++generation;output.textContent='';status.textContent='Opening records…';
 try{const file=document.querySelector('#file').files[0];if(!file||file.size>16*1024*1024)throw Error();
 const report=await decryptPacket(JSON.parse(await file.text()),code.value);if(current!==generation)return;code.value='';output.textContent=JSON.stringify(report,null,2);status.textContent='Records opened on this device. Nothing was uploaded.';
 }catch{if(current!==generation)return;code.value='';status.textContent='The file could not be opened. Check that you selected the records file and entered its separate access code. Contact privacy@firstvololearning.com if you need help.';}});
 document.querySelector('#clear').addEventListener('click',()=>{generation++;form.reset();output.textContent='';status.textContent='Records cleared from this page.';});
}
