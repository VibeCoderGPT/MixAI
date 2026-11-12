import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {wav} from '../src/audio.js';
test('WAV header and bounded PCM samples',async()=>{const blob=wav({numberOfChannels:1,length:3,sampleRate:44100,getChannelData:()=>new Float32Array([-2,0,2])});const d=new DataView(await blob.arrayBuffer());assert.equal(d.getUint32(24,true),44100);assert.equal(d.getInt16(44,true),-32768);assert.equal(d.getInt16(48,true),32767);});
test('import, process, compare, seek, export and mobile layout',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');
 assert.equal(await page.locator('#export').isDisabled(),true);
 const samples=Float32Array.from({length:44100},(_,i)=>.25*Math.sin(2*Math.PI*220*i/44100));const file=Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer());
 await page.locator('#file').setInputFiles({name:'test-tone.wav',mimeType:'audio/wav',buffer:file});await page.waitForFunction(()=>!document.querySelector('#export').disabled);
 await page.getByRole('button',{name:'Basses profondes',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await page.locator('#control-1').inputValue(),'4');
 await page.locator('#play').click();await page.getByRole('button',{name:'Original',exact:true}).click();assert.equal(await page.locator('#original').getAttribute('aria-pressed'),'true');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'test-tone-MixAI.wav');
 const result=await page.evaluate(async()=>{const {render,stats}=await import('/src/audio.js');const ctx=new AudioContext();const b=ctx.createBuffer(2,44100,44100);for(let c=0;c<2;c++)for(let i=0;i<b.length;i++)b.getChannelData(c)[i]=.8*Math.sin(i*.03);const out=await render(b,[100,6,6,6,150]);await ctx.close();return {peak:stats(out).peak,length:out.length};});assert.ok(result.peak<=.892);assert.equal(result.length,44100);
 await page.locator('#file').setInputFiles({name:'bad.wav',mimeType:'audio/wav',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('illisible'));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('preset changes keep playback advancing and respect pause',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.goto('http://localhost:5173');
 const samples=Float32Array.from({length:44100*12},(_,i)=>.2*Math.sin(i*.04));
 await page.locator('#file').setInputFiles({name:'long.wav',mimeType:'audio/wav',buffer:Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer())});
 await page.waitForFunction(()=>!document.querySelector('#export').disabled);await page.locator('#play').click();
 const before=Number(await page.locator('#seek').inputValue());
 await page.getByRole('button',{name:'Punch',exact:true}).click();
 assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');assert.equal(await page.locator('#play').isDisabled(),false);
 await page.waitForFunction(()=>!document.querySelector('#export').disabled);
 await page.waitForFunction(p=>Number(document.querySelector('#seek').value)>p+2,before);
 assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');
 await page.getByRole('button',{name:'Doux',exact:true}).click();await page.getByRole('button',{name:'Streaming',exact:true}).click();
 await page.locator('#play').click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);
 assert.equal(await page.locator('#play').getAttribute('aria-label'),'Lire');assert.equal(await page.locator('#preset-label').textContent(),'Streaming');
 }finally{await browser.close();}
});
