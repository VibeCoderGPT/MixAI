import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {master,loudness,compress} from '../src/mastering.js';
import {wav} from '../src/audio.js';
for(const rate of [44100,48000])test(`mastering meets independent FFmpeg loudness and peak checks at ${rate}`,async()=>{
 const channels=Array.from({length:2},(_,c)=>Float32Array.from({length:rate*4},(_,i)=>{
  const t=i/rate;return .025*(Math.sin(2*Math.PI*220*t)+.5*Math.sin(2*Math.PI*2300*t+c*.3))*(.4+.6*Math.sin(t*3)**2)+(i%Math.floor(rate*.7)<20?.4:0);
 }));
 const input=loudness(channels,rate),result=master(channels,rate,12);
 assert.ok(result.lufs>input+5);assert.ok(result.truePeakDb<=-2);
 const dir=mkdtempSync(join(tmpdir(),'mixai-meter-'));try{
 const path=join(dir,'master.wav');writeFileSync(path,Buffer.from(await wav({numberOfChannels:2,length:channels[0].length,sampleRate:rate,getChannelData:c=>result.channels[c]}).arrayBuffer()));
 const process=spawnSync('ffmpeg',['-hide_banner','-i',path,'-af','loudnorm=I=-14:TP=-1:print_format=json','-f','null','-'],{encoding:'utf8'});
 assert.equal(process.status,0,process.stderr);
 const measured=JSON.parse(process.stderr.slice(process.stderr.lastIndexOf('{'),process.stderr.lastIndexOf('}')+1));
 assert.ok(Math.abs(Number(measured.input_i)-result.lufs)<.5,JSON.stringify(measured));
 assert.ok(Number(measured.input_tp)<=-2,JSON.stringify(measured));
 console.log(`FFmpeg ${rate}: ${measured.input_i} LUFS, ${measured.input_tp} dBTP`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('silence remains silent and finite',()=>{const result=master([new Float32Array(48000)],48000);assert.equal(result.lufs,-Infinity);assert.ok(result.channels[0].every(v=>v===0));});
test('master gain increases loudness while protecting reconstructed peaks',()=>{
 const rate=44100,channels=[Float32Array.from({length:rate*2},(_,i)=>.06*Math.sin(i*.05))];const base=master(channels,rate),boost=master(channels,rate,6),cut=master(channels,rate,-6);
 assert.ok(boost.lufs>base.lufs+3);assert.ok(boost.truePeakDb<=-2);assert.ok(Math.abs(cut.lufs-base.lufs+6)<.1);
});

test('zero gain preserves quiet and loud input below ceiling without LUFS normalization',()=>{
 for(const amplitude of [.02,.6]){const input=Float32Array.from({length:44100},(_,i)=>amplitude*Math.sin(i*.04));const result=master([input],44100);assert.deepEqual(result.channels[0],input);assert.equal(result.lufs,loudness([input],44100));}
});

test('compression reduces level contrast with loudness compensation, rather than adding gain',()=>{
 const rate=44100,input=Float32Array.from({length:rate*4},(_,i)=>((i/rate)%2<1?.04:.35)*Math.sin(i*2*Math.PI*440/rate));
 assert.equal(compress([input],rate,0)[0],input);
 const rms=(data,start,end)=>Math.sqrt(data.slice(start,end).reduce((sum,v)=>sum+v*v,0)/(end-start));
 const contrast=data=>20*Math.log10(rms(data,rate*1.5,rate*1.9)/rms(data,rate*.5,rate*.9));
 let previous=contrast(input);
 for(const intensity of [25,50,100]){const result=compress([input,input],rate,intensity);const measured=contrast(result[0]);assert.ok(measured<previous-.1);previous=measured;assert.ok(Math.abs(loudness(result,rate)-loudness([input,input],rate))<.2);assert.deepEqual(result[0],result[1]);}
 const silent=compress([new Float32Array(rate)],rate,100);assert.ok(silent[0].every(v=>v===0));
});
