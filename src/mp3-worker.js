import {Mp3Encoder} from '@breezystack/lamejs';
self.onmessage=({data:{channels,rate,kbps}})=>{
 try{
  const encoder=new Mp3Encoder(channels.length,rate,kbps),chunks=[];
  for(let i=0;i<channels[0].length;i+=1152){
   const pcm=channels.map(c=>Int16Array.from(c.subarray(i,i+1152),v=>Math.round(Math.max(-1,Math.min(1,v))*32767)));
   const encoded=encoder.encodeBuffer(pcm[0],pcm[1]);if(encoded.length)chunks.push(new Uint8Array(encoded));
   if(i%(1152*40)===0)self.postMessage({progress:i/channels[0].length});
  }
  const tail=encoder.flush();if(tail.length)chunks.push(new Uint8Array(tail));self.postMessage({chunks},chunks.map(c=>c.buffer));
 }catch(error){self.postMessage({error:error.message});}
};
