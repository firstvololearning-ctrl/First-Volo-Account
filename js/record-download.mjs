const products=new Set(['primo-volo','first-volo-story-builder','first-volo-morphology']);
export async function prepareDownload(client,product,isCurrent=()=>true){
 if(!products.has(product))throw Error('Choose a product.');
 const {data,error}=await client.rpc('export_operator_product_records',{p_product:product});
 if(!isCurrent())throw Error('Your sign-in changed. Sign in again before downloading.');
 if(error)throw Error('Download unavailable. Sign in to your operator account and try again.');
 if(data?.version!==1||data.product!==product||!Array.isArray(data.profiles)||!Array.isArray(data.learningRecords))throw Error('The record export could not be verified.');
 return {filename:`first-volo-${product}-records.json`,text:JSON.stringify(data,null,2)};
}
export function startDownloadUI(document,client,save){
 const form=document.getElementById('download'),status=document.getElementById('status'),button=document.getElementById('save');let epoch=0,busy=false;
 client?.auth.onAuthStateChange((event,session)=>{if(!session){epoch++;status.textContent='Sign in through My First Volo before downloading.';}});
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;button.disabled=true;const current=epoch;try{
  if(!client)throw Error('Sign in through My First Volo before downloading.');
  const result=await prepareDownload(client,form.elements.product.value,()=>current===epoch);
  save(result);status.textContent='Download prepared. Keep this file private and remove unnecessary copies when finished. Nothing was sent to a parent.';
 }catch(e){status.textContent=e.message;}finally{busy=false;button.disabled=false;}};
}
