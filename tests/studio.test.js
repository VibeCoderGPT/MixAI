import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {wav} from '../src/audio.js';
test('24-bit WAV encodes PCM, RIFF padding and bounded dither',async()=>{
 const samples=new Float32Array([-2,0,.5,2,0]);const blob=wav({numberOfChannels:1,length:samples.length,sampleRate:48000,getChannelData:()=>samples});const d=new DataView(await blob.arrayBuffer());
 assert.equal(d.getUint32(24,true),48000);assert.equal(d.getUint16(34,true),24);assert.equal(d.getUint16(32,true),3);assert.equal(d.getUint32(40,true),15);assert.equal(d.byteLength,60);assert.equal(d.getUint32(4,true),52);
 const pcm=i=>{const o=44+i*3,v=d.getUint8(o)|(d.getUint8(o+1)<<8)|(d.getUint8(o+2)<<16);return v&0x800000?v-0x1000000:v;};
 assert.equal(pcm(0),-8388608);assert.ok(Math.abs(pcm(1))<=1);assert.ok(Math.abs(pcm(2)-4194304)<=1);assert.equal(pcm(3),8388607);
});
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
test('waveform hover highlights a bar and clicks seek paused or playing',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.goto('http://localhost:5173');
 await page.locator('#wave').click();assert.equal(await page.locator('#play').isDisabled(),true);
 const samples=Float32Array.from({length:44100*12},(_,i)=>.6*Math.sin(i*.04));
 await page.locator('#file').setInputFiles({name:'seek.wav',mimeType:'audio/wav',buffer:Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer())});
 await page.waitForFunction(()=>!document.querySelector('#export').disabled);
 const box=await page.locator('#wave').boundingBox();const x=Math.floor(box.width/8)*4+1;
 await page.mouse.move(box.x+x,box.y+box.height/2);
 const pixel=()=>page.evaluate(x=>{const c=document.querySelector('#wave');return [...c.getContext('2d').getImageData(Math.floor(x*devicePixelRatio),Math.floor(c.height/2),1,1).data].slice(0,3);},x);
 assert.deepEqual(await pixel(),[255,255,255]);
 await page.mouse.move(0,0);assert.deepEqual(await pixel(),[255,117,71]);
 await page.mouse.click(box.x+box.width*.5,box.y+box.height/2);
 assert.ok(Math.abs(Number(await page.locator('#seek').inputValue())-50)<1);assert.equal(await page.locator('#play').getAttribute('aria-label'),'Lire');
 await page.locator('#play').click();await page.mouse.click(box.x+box.width*.25,box.y+box.height/2);
 assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');
 await page.waitForFunction(()=>Number(document.querySelector('#seek').value)>28);
 }finally{await browser.close();}
});
test('one white waveform bar follows playback and paused seeking',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.goto('http://localhost:5173');const samples=Float32Array.from({length:44100*8},(_,i)=>.5*Math.sin(i*.04));
 await page.locator('#file').setInputFiles({name:'cursor.wav',mimeType:'audio/wav',buffer:Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer())});await page.waitForFunction(()=>!document.querySelector('#export').disabled);await page.mouse.move(0,0);
 const check=()=>page.evaluate(()=>{const c=document.querySelector('#wave'),ctx=c.getContext('2d'),width=c.getBoundingClientRect().width;const white=[];for(let x=0;x<width;x+=4){const p=ctx.getImageData(Math.floor((x+1)*devicePixelRatio),Math.floor(c.height/2),1,1).data;if(p[0]===255&&p[1]===255&&p[2]===255)white.push(x/4);}return {white,expected:Math.min(Math.ceil(width/4)-1,Math.round(Number(document.querySelector('#seek').value)/100*width/4))};});
 assert.deepEqual((await check()).white,[0]);await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#seek').value)>5);let state=await check();assert.deepEqual(state.white,[state.expected]);assert.ok(state.expected>0);
 await page.locator('#play').click();await page.locator('#seek').evaluate(el=>{el.value=75;el.dispatchEvent(new Event('input'));});await page.waitForTimeout(100);state=await check();assert.deepEqual(state.white,[state.expected]);assert.equal(await page.locator('#play').getAttribute('aria-label'),'Lire');
 }finally{await browser.close();}
});
test('master gain updates the processed waveform and original remains unchanged',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.goto('http://localhost:5173');const samples=Float32Array.from({length:44100*2},(_,i)=>.03*Math.sin(i*.04));
 await page.locator('#file').setInputFiles({name:'gain.wav',mimeType:'audio/wav',buffer:Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer())});await page.waitForFunction(()=>!document.querySelector('#export').disabled);await page.mouse.move(0,0);
 const capture=()=>page.locator('#wave').evaluate(c=>c.toDataURL());const initial=await capture();
 await page.locator('#original').click();await page.waitForTimeout(100);const original=await capture();assert.notEqual(initial,original);
 await page.locator('#master').click();await page.locator('#master-gain').evaluate(el=>{el.value=6;el.dispatchEvent(new Event('input'));});assert.equal(await page.locator('#gain-loading').isVisible(),true);assert.equal(await page.locator('#wave-loading').isVisible(),true);await page.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await page.locator('#gain-loading').isVisible(),false);assert.equal(await page.locator('#wave-loading').isVisible(),false);assert.notEqual(await capture(),initial);assert.equal(await page.locator('#master-gain-value').textContent(),'+6 dB');
 await page.locator('#original').click();await page.waitForTimeout(100);assert.equal(await capture(),original);assert.equal(await page.getByText('Audio 100 % local').count(),0);
 }finally{await browser.close();}
});
test('intensity increases density without reducing loudness on sustained and transient mixes',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const page=await browser.newPage();await page.goto('http://localhost:5173');const results=await page.evaluate(async()=>{
 const {render}=await import('/src/audio.js');const rows=[];
 for(const type of ['dense','transient']){const b=new AudioBuffer({length:44100*3,sampleRate:44100,numberOfChannels:2});for(let c=0;c<2;c++)for(let i=0;i<b.length;i++){const t=i/44100;const envelope=type==='dense'?.7+.2*Math.sin(t*8):.12+.88*Math.exp(-15*(t%.4));b.getChannelData(c)[i]=.65*envelope*(Math.sin(t*1382)+.2*Math.sin(t*5300+c*.2));}const levels=[];for(const intensity of [0,25,50,75,100]){const out=await render(b,[intensity,1,1,1,100],6);levels.push(out.mastering);}rows.push({type,levels});}return rows;});
 for(const row of results){for(let i=0;i<row.levels.length;i++){assert.ok(row.levels[i].truePeakDb<=-2,JSON.stringify(row));if(i)assert.ok(row.levels[i].lufs>=row.levels[i-1].lufs-.1,JSON.stringify(row));}}console.log(JSON.stringify(results));
 }finally{await browser.close();}
});
