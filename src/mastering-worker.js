import {master} from './mastering.js';
self.onmessage=({data})=>{try{const result=master(data.channels,data.rate,data.target);self.postMessage(result,result.channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
