export function preparePrivacyEmail(kind,product) {
 const kinds={review:'Review information',withdrawal:'Withdraw permission',deletion:'Request deletion',correction:'Request a correction',question:'Ask a privacy question'};
 const products={story:'First Volo Story Builder',primo:'Primo Volo',morphology:'First Volo Morphology',unsure:'Not sure / more than one product'};
 if(!Object.hasOwn(kinds,kind)||!Object.hasOwn(products,product))throw Error('Choose a request and product.');
 const subject=`First Volo privacy request: ${kinds[kind]}`;
 const body=`Hello First Volo,\n\nI would like to: ${kinds[kind]}.\nProduct: ${products[product]}.\n\nPlease reply with the next steps to verify my authority and locate the appropriate record.\n\nI have not included a child's name, work, diagnosis, ID documents or login codes.\n`;
 return 'mailto:privacy@firstvololearning.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
if(typeof document!=='undefined'){
 document.querySelector('form').addEventListener('submit',event=>{
 event.preventDefault();
 const link=preparePrivacyEmail(document.querySelector('#kind').value,document.querySelector('#product').value);
 document.querySelector('#status').textContent='Your email app will open a draft. Send it there to make your request. This page has not submitted a request or changed any records.';
 window.location.href=link;
 });
}
