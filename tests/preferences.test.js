import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {wav} from '../src/audio.js';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('language, theme, desktop controls, MP3 exports and responsive layout',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const dir=mkdtempSync(join(tmpdir(),'mixai-export-'));
 try{const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');
 assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('h1').textContent(),'Mastering studio');assert.equal(await page.locator('#status').textContent(),'');
 await page.locator('#language').click();assert.equal(await page.locator('h1').textContent(),'Studio de mastering');await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'fr');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.locator('#language').click();
 await page.locator('label[for="control-1"]').click();await page.locator('#control-1').hover();const old=Number(await page.locator('#control-1').inputValue());await page.mouse.wheel(0,-100);await page.waitForFunction(v=>Number(document.querySelector('#control-1').value)===v+1,old);await page.keyboard.press('Escape');assert.equal(Number(await page.locator('#control-1').inputValue()),old);
 await page.locator('label[for="control-1"]').click();await page.mouse.wheel(0,-100);await page.waitForFunction(v=>Number(document.querySelector('#control-1').value)===v+1,old);await page.keyboard.press('Enter');assert.equal(await page.locator('.wheel-selected').count(),0);
 const samples=Float32Array.from({length:44100*4},(_,i)=>.05*Math.sin(i*.04));await page.locator('#file').setInputFiles({name:'sample.wav',mimeType:'audio/wav',buffer:Buffer.from(await wav({numberOfChannels:1,length:samples.length,sampleRate:44100,getChannelData:()=>samples}).arrayBuffer())});await page.waitForFunction(()=>!document.querySelector('#export').disabled);
 await page.locator('h1').click();await page.keyboard.press('Space');assert.equal(await page.locator('#play').getAttribute('aria-label'),'Pause');await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-label')==='Play');
 for(const bitrate of ['192','320']){await page.locator('#export-format').selectOption(bitrate);const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading;assert.equal(download.suggestedFilename(),'sample-MixAI.mp3');const path=join(dir,bitrate+'.mp3');await download.saveAs(path);const result=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,bit_rate,sample_rate,channels:format=duration','-of','json',path],{encoding:'utf8'});assert.equal(result.status,0);const info=JSON.parse(result.stdout);assert.equal(info.streams[0].codec_name,'mp3');assert.equal(Number(info.streams[0].bit_rate),Number(bitrate)*1000);assert.ok(Math.abs(Number(info.format.duration)-4)<.2);}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'desktop fits at 1366x768');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 }finally{await browser.close();rmSync(dir,{recursive:true,force:true});}
});
