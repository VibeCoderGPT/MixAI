export const presets = {
  'Équilibré': [45, 1, 1, 1, 100],
  'Basses profondes': [55, 4, 0, 2, 105],
  'Voix claire': [35, -1, 3, 0, 100],
  'Punch': [70, 2, 2, 1, 110],
  'Doux': [20, 0, -2, 3, 95],
  'Streaming': [40, 1, 1, 0, 100],
};
export function chain(ctx, input, values) {
  const [intensity, bass, clarity, warmth, width] = values;
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 120; low.gain.value = bass;
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 350; mid.Q.value = .7; mid.gain.value = warmth;
  const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3500; high.gain.value = clarity;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10 - intensity * .22; comp.ratio.value = 1 + intensity * .05; comp.knee.value = 20; comp.attack.value = .015; comp.release.value = .2;
  input.connect(low).connect(mid).connect(high).connect(comp);
  const splitter = ctx.createChannelSplitter(2), merger = ctx.createChannelMerger(2);
  comp.connect(splitter);
  for (let output = 0; output < 2; output++) for (let source = 0; source < 2; source++) {
    const gain = ctx.createGain(); gain.gain.value = source === output ? (1 + width / 100) / 2 : (1 - width / 100) / 2;
    splitter.connect(gain, source); gain.connect(merger, 0, output);
  }
  return merger;
}
export function stats(buffer) {
  let peak = 0, sum = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) for (const v of buffer.getChannelData(c)) { peak = Math.max(peak, Math.abs(v)); sum += v*v; }
  return {peak, rms: Math.sqrt(sum / (buffer.length * buffer.numberOfChannels))};
}
let baseCache, cancelGain;
export function cancelPendingGain(){cancelGain?.();cancelGain=null;}
function runWorker(payload,channels){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./mastering-worker.js',import.meta.url),{type:'module'});
  if(payload.base){cancelPendingGain();cancelGain=()=>{worker.terminate();reject(new Error('Superseded gain'));};}
  worker.onmessage=({data})=>{worker.terminate();if(payload.base)cancelGain=null;data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};
  worker.postMessage(payload,channels.map(c=>c.buffer));
 });
}
export async function render(buffer, values, masterGain=0) {
 const key=JSON.stringify(values);
 if(!baseCache||baseCache.buffer!==buffer||baseCache.key!==key){
  const promise=(async()=>{
   const ctx=new OfflineAudioContext(2,buffer.length,buffer.sampleRate);
   const source=ctx.createBufferSource();source.buffer=buffer;chain(ctx,source,values).connect(ctx.destination);source.start();
   const rendered=await ctx.startRendering();
   const channels=Array.from({length:2},(_,c)=>rendered.getChannelData(c).slice());
   return runWorker({channels,rate:buffer.sampleRate,target:-14},channels);
  })();
  baseCache={buffer,key,promise};
  promise.catch(()=>{if(baseCache?.promise===promise)baseCache=null;});
 }
 const base=await baseCache.promise;
 let measured=base;
 if(masterGain!==0){const channels=base.channels.map(c=>c.slice());measured=await runWorker({base:{...base,channels},rate:buffer.sampleRate,masterGain},channels);}
 const result=new AudioBuffer({numberOfChannels:2,length:buffer.length,sampleRate:buffer.sampleRate});
 measured.channels.forEach((data,c)=>result.copyToChannel(data,c));
 result.mastering={lufs:measured.lufs,truePeakDb:measured.truePeakDb,target:measured.target,limited:measured.limited};
 return result;
}
export function wav(buffer) {
  const channels = buffer.numberOfChannels, size = buffer.length * channels * 2;
  const data = new ArrayBuffer(44 + size), view = new DataView(data);
  const str = (offset, value) => [...value].forEach((v, i) => view.setUint8(offset+i, v.charCodeAt(0)));
  str(0,'RIFF'); view.setUint32(4,36+size,true); str(8,'WAVE'); str(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true); view.setUint32(24,buffer.sampleRate,true); view.setUint32(28,buffer.sampleRate*channels*2,true); view.setUint16(32,channels*2,true); view.setUint16(34,16,true); str(36,'data'); view.setUint32(40,size,true);
  for(let i=0;i<buffer.length;i++) for(let c=0;c<channels;c++) { const v=Math.max(-1,Math.min(1,buffer.getChannelData(c)[i])); view.setInt16(44+(i*channels+c)*2,Math.round(v*(v<0?32768:32767)),true); }
  return new Blob([data],{type:'audio/wav'});
}
