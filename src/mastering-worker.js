import {analyze,applyMasterGain} from './mastering.js';
self.onmessage=({data})=>{try{const result=data.base?applyMasterGain(data.base,data.rate,data.masterGain):analyze(data.channels,data.rate);self.postMessage(result,result.channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
