// BS.1770 K weighting and gated integrated loudness for mono/stereo PCM.
function biquad(data, b, a) {
 const out=new Float64Array(data.length);let x1=0,x2=0,y1=0,y2=0;
 for(let i=0;i<data.length;i++){const x=data[i],y=b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;out[i]=y;x2=x1;x1=x;y2=y1;y1=y;}return out;
}
export function loudness(channels, rate){
 const K=Math.tan(Math.PI*1681.974450955533/rate),Vh=10**(3.999843853973347/20),Vb=Vh**.4996667741545416,Q=.7071752369554196,D=1+K/Q+K*K;
 const b=[(Vh+Vb*K/Q+K*K)/D,2*(K*K-Vh)/D,(Vh-Vb*K/Q+K*K)/D],a=[1,2*(K*K-1)/D,(1-K/Q+K*K)/D];
 const k=Math.tan(Math.PI*38.13547087602444/rate),q=.5003270373238773,d=1+k/q+k*k;
 const energies=new Float64Array(channels[0].length);
 for(const channel of channels){const filtered=biquad(biquad(channel,b,a),[1,-2,1],[1,2*(k*k-1)/d,(1-k/q+k*k)/d]);for(let i=0;i<filtered.length;i++)energies[i]+=filtered[i]*filtered[i];}
 const block=Math.round(rate*.4),step=Math.round(rate*.1),blocks=[];let sum=0;
 for(let i=0;i<energies.length;i++){sum+=energies[i];if(i>=block)sum-=energies[i-block];if(i>=block-1&&(i-block+1)%step===0)blocks.push(sum/block);}
 const absolute=blocks.filter(e=>e>0&&-.691+10*Math.log10(e)>=-70);if(!absolute.length)return -Infinity;
 const mean=absolute.reduce((a,b)=>a+b,0)/absolute.length;const gated=absolute.filter(e=>e>=mean*.1);
 return -.691+10*Math.log10(gated.reduce((a,b)=>a+b,0)/gated.length);
}
// Four-phase windowed-sinc reconstruction; leave 0.2 dB safety margin below the ceiling.
export function truePeak(channels){
 const kernels=[1,2,3].map(phase=>{const taps=[];let sum=0;for(let j=-15;j<=16;j++){const x=phase/4-j;const v=(Math.sin(Math.PI*x)/(Math.PI*x))*(.5+.5*Math.cos(Math.PI*x/16));taps.push(v);sum+=v;}return taps.map(v=>v/sum);});
 let peak=0;for(const data of channels){for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));for(const taps of kernels){let value=0;const start=Math.max(0,15-i),end=Math.min(32,data.length-i+15);for(let j=start;j<end;j++)value+=data[i+j-15]*taps[j];peak=Math.max(peak,Math.abs(value));}}}return peak;
}
function limit(channels,rate,gain,ceiling){
 const length=channels[0].length,look=Math.round(rate*.005),peaks=new Float32Array(length),future=new Float32Array(length),queue=new Int32Array(length);let head=0,tail=0;
 for(let i=0;i<length;i++)for(const data of channels)peaks[i]=Math.max(peaks[i],Math.abs(data[i]*gain));
 for(let i=length-1;i>=0;i--){while(head<tail&&queue[head]>i+look)head++;while(head<tail&&peaks[queue[tail-1]]<=peaks[i])tail--;queue[tail++]=i;future[i]=peaks[queue[head]];}
 const release=Math.exp(-1/(rate*.08)),attack=Math.exp(-1/(rate*.001));let envelope=1;
 const out=channels.map(()=>new Float32Array(length));
 for(let i=0;i<length;i++){const wanted=Math.min(1,ceiling/(future[i]||1));envelope=wanted<envelope?wanted+(envelope-wanted)*attack:1-(1-envelope)*release;const safe=Math.min(envelope,ceiling/(peaks[i]||1));for(let c=0;c<out.length;c++)out[c][i]=channels[c][i]*gain*safe;}
 return out;
}
export function master(channels,rate,target=-14,ceilingDb=-1,masterGain=0){
 const inputLUFS=loudness(channels,rate),ceiling=10**((ceilingDb-.2)/20);
 if(!Number.isFinite(inputLUFS)){const peak=truePeak(channels),gain=Math.min(1,ceiling/(peak||1));const out=channels.map(c=>c.map(v=>v*gain));return {channels:out,lufs:inputLUFS,truePeakDb:20*Math.log10(peak*gain),target,limited:true};}
 let drive=Math.min(30,target-inputLUFS),out,measured,peak;
 for(let pass=0;pass<4;pass++){
  out=limit(channels,rate,10**(drive/20),ceiling);peak=truePeak(out);
  if(peak>ceiling){const correction=ceiling/peak;for(const data of out)for(let i=0;i<data.length;i++)data[i]*=correction;peak=ceiling;}
  measured=loudness(out,rate);const error=target-measured;if(Math.abs(error)<.2||drive>=30)break;drive=Math.min(30,drive+error);
 }
 if(masterGain!==0)return applyMasterGain({channels:out,lufs:measured,truePeakDb:20*Math.log10(peak),target,limited:Math.abs(target-measured)>.5},rate,masterGain);

 return {channels:out,lufs:measured,truePeakDb:20*Math.log10(peak),target,limited:Math.abs(target-measured)>.5};
}

export function applyMasterGain(base,rate,gainDb){
 if(gainDb===0)return base;
 const ceiling=10**(-1.2/20),gain=10**(gainDb/20);
 if(base.truePeakDb+gainDb<=-1.2)return {...base,channels:base.channels.map(c=>c.map(v=>v*gain)),lufs:base.lufs+gainDb,truePeakDb:base.truePeakDb+gainDb};
 const out=limit(base.channels,rate,gain,ceiling);let peak=truePeak(out);
 if(peak>ceiling){const correction=ceiling/peak;for(const data of out)for(let i=0;i<data.length;i++)data[i]*=correction;peak=ceiling;}
 return {...base,channels:out,lufs:loudness(out,rate),truePeakDb:20*Math.log10(peak)};
}
