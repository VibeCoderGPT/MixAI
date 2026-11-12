import {analyze,applyMasterGain,compress} from './mastering.js';
self.onmessage=({data})=>{try{const result=data.base?applyMasterGain(data.base,data.rate,data.masterGain):analyze(compress(data.channels,data.rate,data.intensity||0),data.rate);self.postMessage(result,result.channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
