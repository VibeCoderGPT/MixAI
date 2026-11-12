import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {master,loudness} from '../src/mastering.js';
import {wav} from '../src/audio.js';
for(const rate of [44100,48000])test(`mastering meets independent FFmpeg loudness and peak checks at ${rate}`,async()=>{
 const channels=Array.from({length:2},(_,c)=>Float32Array.from({length:rate*4},(_,i)=>{
  const t=i/rate;return .025*(Math.sin(2*Math.PI*220*t)+.5*Math.sin(2*Math.PI*2300*t+c*.3))*(.4+.6*Math.sin(t*3)**2)+(i%Math.floor(rate*.7)<20?.4:0);
 }));
 const input=loudness(channels,rate),result=master(channels,rate);
 assert.ok(result.lufs>input+5);assert.ok(Math.abs(result.lufs+14)<.5);assert.ok(result.truePeakDb<=-1);
 const dir=mkdtempSync(join(tmpdir(),'mixai-meter-'));try{
 const path=join(dir,'master.wav');writeFileSync(path,Buffer.from(await wav({numberOfChannels:2,length:channels[0].length,sampleRate:rate,getChannelData:c=>result.channels[c]}).arrayBuffer()));
 const process=spawnSync('ffmpeg',['-hide_banner','-i',path,'-af','loudnorm=I=-14:TP=-1:print_format=json','-f','null','-'],{encoding:'utf8'});
 assert.equal(process.status,0,process.stderr);
 const measured=JSON.parse(process.stderr.slice(process.stderr.lastIndexOf('{'),process.stderr.lastIndexOf('}')+1));
 assert.ok(Math.abs(Number(measured.input_i)+14)<.5,JSON.stringify(measured));
 assert.ok(Number(measured.input_tp)<=-1,JSON.stringify(measured));
 console.log(`FFmpeg ${rate}: ${measured.input_i} LUFS, ${measured.input_tp} dBTP`);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('silence remains silent and finite',()=>{const result=master([new Float32Array(48000)],48000);assert.equal(result.lufs,-Infinity);assert.ok(result.channels[0].every(v=>v===0));});
