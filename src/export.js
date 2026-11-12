export async function mp3(buffer,kbps,onProgress){
 // MP3 supports up to 48 kHz. Resample only when its format requires it.
 let audio=buffer;
 if(![32000,44100,48000].includes(buffer.sampleRate)){
  const context=new OfflineAudioContext(buffer.numberOfChannels,Math.ceil(buffer.duration*48000),48000);
  const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();audio=await context.startRendering();
 }
 const channels=Array.from({length:audio.numberOfChannels},(_,c)=>audio.getChannelData(c).slice());
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./mp3-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(data.progress!==undefined){onProgress?.(data.progress);return;}worker.terminate();data.error?reject(new Error(data.error)):resolve(new Blob(data.chunks,{type:'audio/mpeg'}));};
  worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
  worker.postMessage({channels,rate:audio.sampleRate,kbps},channels.map(c=>c.buffer));
 });
}
