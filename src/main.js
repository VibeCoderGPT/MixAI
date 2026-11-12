import './style.css';
import {presets, render, stats, wav, cancelPendingGain} from './audio.js';
const $ = s => document.querySelector(s);
const labels = ['Intensité', 'Basses', 'Clarté', 'Chaleur', 'Largeur stéréo'];
const hints = ['Compression · niveau compensé · 0 % = désactivée', 'Le poids du bas du spectre', 'La présence des voix et des détails', 'Du corps dans les bas médiums', 'L’espace entre la gauche et la droite'];
let masterGain = 0;
let values = [...presets['Équilibré']], buffer, processed, context, source, sourceGain, playing=false, offset=0, started=0, mode='master', revision=0, busy=false, showLoading=false;
$('#app').innerHTML = `
<header><a class="brand" href="./" aria-label="MixAI accueil"><span class="signal-logo" aria-hidden="true"><i></i><i></i><i></i></span> MixAI</a><span class="header-label">MASTERING</span></header>
<main><div class="workspace"><aside class="sidebar"><div class="section-heading"><h2>Préréglages</h2></div><div class="presets">${Object.keys(presets).map((p,i)=>`<button data-preset="${p}" aria-pressed="${i===0}" class="${i===0?'selected':''}"><span class="preset-icon" aria-hidden="true">${['≋','≡','◈','ϟ','≈','◎'][i]}</span>${p}</button>`).join('')}</div></aside><div class="studio"><section class="track-panel"><div class="section-heading"><h1>Studio de mastering</h1></div>
<input id="file" type="file" accept="audio/*,.wav,.mp3,.flac,.m4a" hidden>
<button id="drop" class="drop"><span class="upload-symbol">↑</span><strong>Déposez votre chanson ici</strong><span>ou cliquez pour choisir un fichier</span><small>WAV, MP3, FLAC, M4A · jusqu’à 80 Mo et 5 minutes</small></button>
<div class="track-info" hidden><div class="track-icon">♫</div><div><strong id="filename"></strong><small id="fileinfo"></small></div><button id="replace" class="text-button">Remplacer</button></div>
<div class="wave-wrap"><canvas id="wave" aria-label="Forme d’onde du morceau"></canvas><div id="wave-loading" hidden role="status"><strong>Mise à jour du son…</strong><progress aria-label="Mise à jour de la forme d’onde"></progress></div><div id="empty-wave">Votre forme d’onde apparaîtra ici</div></div>
<input id="seek" aria-label="Position de lecture" type="range" min="0" max="100" value="0" step="0.1" disabled><div class="time"><span id="time">0:00</span><span id="duration">0:00</span></div>
<div class="transport"><button id="play" class="play" disabled aria-label="Lire">▶</button><div class="compare" aria-label="Comparaison"><button id="original" aria-pressed="false">Original</button><button id="master" class="active" aria-pressed="true">Master</button></div><span class="match">Gain ajustable · sans normalisation<br>Plafond −2 dBTP</span></div>
<div class="metrics"><div><small>CRÊTE TRUE PEAK</small><strong id="peak">— <em>dBTP</em></strong></div><div><small>VOLUME INTÉGRÉ</small><strong id="lufs">— <em>LUFS</em></strong></div><div><small>EXPORT</small><strong>WAV <em>24 bits</em></strong></div></div>
</section><section class="settings"><div class="preset-heading"><span>Couleur du son</span><span id="preset-label">Équilibré</span></div><div class="controls">${labels.map((l,i)=>`<div class="control ${i===0?'intensity':''}"><div><label for="control-${i}">${l}</label><output id="value-${i}"></output></div><input id="control-${i}" type="range" min="${i===0?0:i===4?50:-6}" max="${i===0?100:i===4?150:6}" step="1" value="${values[i]}"><span class="knob" aria-hidden="true"><span class="knob-face"><i></i></span></span><small>${hints[i]}</small></div>`).join('')}</div><div class="master-gain"><div><label for="master-gain">Gain master</label><output id="master-gain-value">0 dB</output></div><input id="master-gain" type="range" min="-12" max="12" step="0.5" value="0"><small>Gain avant limitation · plafond −2 dBTP</small><div id="gain-loading" hidden role="status"><progress aria-label="Traitement du master en cours"></progress><span>Calcul du master… L’écoute conserve le dernier réglage prêt.</span></div></div><button id="reset" class="text-button reset">↺ Réinitialiser les réglages</button></section>
<div class="export-bar"><div><strong>Votre master, prêt à emporter.</strong><span id="status" role="status" aria-live="polite">Importez un morceau pour commencer.</span></div><button id="export" class="export" disabled>Exporter WAV <span aria-hidden="true">↓</span></button></div></div></div></main>`;
function status(text,error=false){ $('#status').textContent=text; $('#status').classList.toggle('error',error); }
function sync(){values.forEach((v,i)=>{ $(`#control-${i}`).value=v; const input=$(`#control-${i}`); const fraction=(v-Number(input.min))/(Number(input.max)-Number(input.min)); input.closest(".control").style.setProperty("--angle",`${-135+fraction*270}deg`); input.closest(".control").style.setProperty("--fill",`${fraction*270}deg`); $(`#value-${i}`).textContent=i===0||i===4?`${v} %`:`${v>0?'+':''}${v} dB`; });}
sync();
function time(n){return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;}
function position(){return playing?Math.min(buffer.duration,offset+context.currentTime-started):offset;}
const voices = new Set();
function release(voice) { voice.source.disconnect(); voice.gain.disconnect(); voices.delete(voice); }
function stop(){
 for(const voice of voices){voice.source.onended=null;try{voice.source.stop();}catch{}release(voice);}
 source=null;sourceGain=null;playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Lire');
}
function startVoice(audio, pos, when, fade=false){
 const next=context.createBufferSource(), gain=context.createGain();next.buffer=audio;next.connect(gain).connect(context.destination);
 gain.gain.setValueAtTime(fade?0:1,when);if(fade)gain.gain.linearRampToValueAtTime(1,when+.04);
 const voice={source:next,gain};voices.add(voice);
 next.onended=()=>{release(voice);if(source===next){source=null;sourceGain=null;playing=false;offset=0;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Lire');}};
 next.start(when,pos);source=next;sourceGain=gain;
}
function swapMaster(){
 if(!playing||mode!=='master'||!source)return;
 const when=context.currentTime+.02, pos=position()+.02;
 if(pos>=buffer.duration)return;
 const old=source, gain=sourceGain;
 gain.gain.cancelAndHoldAtTime(when);gain.gain.linearRampToValueAtTime(0,when+.04);old.stop(when+.04);
 startVoice(processed,pos,when,true);
}
async function play(){
 if(!buffer||(mode==='master'&&!processed)||playing)return;
 context ||= new AudioContext();await context.resume();
 const pos=offset>=buffer.duration?0:offset;startVoice(mode==='master'?processed:buffer,pos,context.currentTime);
 offset=pos;started=context.currentTime;playing=true;$('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label','Pause');
}
$('#play').onclick=()=>{if(playing){offset=position();stop();}else play();};
for(const m of ['original','master']) $(`#${m}`).onclick=()=>{const resume=playing;offset=position();stop();mode=m;$('#wave-loading').hidden=mode!=='master'||!busy||!showLoading;draw();for(const id of ['original','master']){$(`#${id}`).classList.toggle('active',id===m);$(`#${id}`).setAttribute('aria-pressed',id===m);}if(resume)play();};
function seekTo(fraction){if(!buffer)return;const resume=playing;stop();offset=Math.max(0,Math.min(1,fraction))*buffer.duration;$('#seek').value=offset/buffer.duration*100;$('#time').textContent=time(offset);if(resume)play();}
$('#seek').oninput=()=>seekTo(Number($('#seek').value)/100);
let hoveredBar = -1;
const waveform = $('#wave');
waveform.onpointermove=e=>{if(!buffer)return;const rect=waveform.getBoundingClientRect();hoveredBar=Math.floor((e.clientX-rect.left)/4)*4;draw();};
waveform.onpointerleave=()=>{hoveredBar=-1;draw();};
waveform.onclick=e=>{if(!buffer)return;const rect=waveform.getBoundingClientRect();seekTo((e.clientX-rect.left)/rect.width);};
let waveCache = {buffer:null,width:0,peaks:[]};
function draw(){
 const canvas=$('#wave'),r=canvas.getBoundingClientRect();
 canvas.width=r.width*devicePixelRatio;canvas.height=r.height*devicePixelRatio;
 const c=canvas.getContext('2d');c.scale(devicePixelRatio,devicePixelRatio);
 // Cache amplitude bins so playback frames never rescan the entire song.
 const displayBuffer=mode==='master'?(processed||buffer):buffer;
 if(waveCache.buffer!==displayBuffer||waveCache.width!==r.width){
  const data=displayBuffer?.getChannelData(0),peaks=[];
  for(let x=0;x<r.width;x+=4){let peak=.025;if(data){const start=Math.floor(x/r.width*data.length),end=Math.min(data.length,Math.floor((x+4)/r.width*data.length));for(let j=start;j<end;j++)peak=Math.max(peak,Math.abs(data[j]));}peaks.push(peak);}
  waveCache={buffer:displayBuffer,width:r.width,peaks};
 }
 const current=buffer?Math.min(waveCache.peaks.length-1,Math.round(Number($('#seek').value)/100*r.width/4)):-1;
 waveCache.peaks.forEach((peak,i)=>{const x=i*4;c.fillStyle=buffer?(i===current||x===hoveredBar?'#FFFFFF':'#FF7547'):'#363c45';const h=Math.max(2,peak*r.height*.85);c.fillRect(x,(r.height-h)/2,2,h);});
}
new ResizeObserver(draw).observe($('#wave'));
async function update(indicate=false){if(!buffer)return;showLoading=indicate;const ticket=++revision;busy=true;$('#gain-loading').hidden=!showLoading;$('#wave-loading').hidden=mode!=='master'||!showLoading;$('.master-gain').setAttribute('aria-busy','true');$('#export').disabled=true;$('#play').disabled=!processed;status('Préparation de votre master…');try{const result=await render(buffer,[...values],masterGain);if(ticket!==revision)return;processed=result;if(mode==='master')draw();swapMaster();const measurement=result.mastering;
$('#peak').innerHTML=`${Number.isFinite(measurement.truePeakDb)?measurement.truePeakDb.toFixed(1):'−∞'} <em>dBTP</em>`;
$('#lufs').innerHTML=`${Number.isFinite(measurement.lufs)?measurement.lufs.toFixed(1):'−∞'} <em>LUFS</em>`;
status('Master prêt · gain '+(masterGain>0?'+':'')+masterGain+' dB · plafond −2 dBTP.');}catch(e){if(ticket!==revision)return;status('Mise à jour impossible. Le dernier master reste disponible. Réessayez.',true);}finally{if(ticket===revision){busy=false;$('#gain-loading').hidden=true;$('#wave-loading').hidden=true;$('.master-gain').setAttribute('aria-busy','false');$('#export').disabled=!processed;$('#play').disabled=!processed;}}}
let timer;function schedule(indicate=false){if(buffer){showLoading=indicate;busy=true;$('#gain-loading').hidden=!showLoading;$('#wave-loading').hidden=mode!=='master'||!showLoading;$('.master-gain').setAttribute('aria-busy','true');$('#export').disabled=true;$('#play').disabled=!processed;status('Mise à jour du son…');++revision;cancelPendingGain();clearTimeout(timer);timer=setTimeout(()=>update(indicate),120);}}
values.forEach((_,i)=>$(`#control-${i}`).oninput=e=>{values[i]=Number(e.target.value);sync();$('#preset-label').textContent='Personnalisé';document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});schedule(i===0);});
function preset(name){values=[...presets[name]];sync();$('#preset-label').textContent=name;document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('selected',b.dataset.preset===name);b.setAttribute('aria-pressed',b.dataset.preset===name);});schedule();}
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));$('#reset').onclick=()=>{masterGain=0;$('#master-gain').value=0;$('#master-gain-value').textContent='0 dB';preset('Équilibré');};
$('#master-gain').oninput=e=>{masterGain=Number(e.target.value);$('#master-gain-value').textContent=(masterGain>0?'+':'')+masterGain+' dB';schedule(true);};
let loadTicket=0;
async function load(file){if(!file)return;if(file.size>80*1024*1024){status('Ce fichier dépasse 80 Mo. Choisissez une version plus légère.',true);return;}const ticket=++loadTicket;status('Lecture du fichier…');try{context ||= new AudioContext();const decoded=await context.decodeAudioData(await file.arrayBuffer());if(ticket!==loadTicket)return;if(decoded.duration>300)throw Error('long');if(decoded.numberOfChannels>2)throw Error('channels');clearTimeout(timer);++revision;stop();offset=0;buffer=decoded;hoveredBar=-1;waveform.classList.add('interactive');processed=null;$('#filename').textContent=file.name;$('#fileinfo').textContent=`${time(buffer.duration)} · ${buffer.numberOfChannels===1?'Mono':'Stéréo'} · ${(file.size/1024/1024).toFixed(1)} Mo`;$('.track-info').hidden=false;$('#drop').hidden=true;$('#empty-wave').hidden=true;$('#duration').textContent=time(buffer.duration);$('#seek').disabled=false;draw();await update();}catch(e){status(e.message==='long'?'Limite de 5 minutes par morceau.':e.message==='channels'?'Choisissez un fichier mono ou stéréo.':'Ce fichier audio est illisible. Essayez un WAV ou un MP3.',true);}}
$('#drop').onclick=$('#replace').onclick=()=>$('#file').click();$('#file').onchange=e=>{load(e.target.files[0]);e.target.value='';};
$('#drop').ondragover=e=>{e.preventDefault();$('#drop').classList.add('drag');};$('#drop').ondragleave=()=>$('#drop').classList.remove('drag');$('#drop').ondrop=e=>{e.preventDefault();$('#drop').classList.remove('drag');load(e.dataTransfer.files[0]);};
$('#export').onclick=()=>{if(!processed||busy)return;const url=URL.createObjectURL(wav(processed));const a=document.createElement('a');a.href=url;a.download=$('#filename').textContent.replace(/\.[^.]+$/,'')+'-MixAI.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Votre master WAV 24 bits a été téléchargé.');};
setInterval(()=>{if(buffer){const p=position();$('#time').textContent=time(p);$('#seek').value=p/buffer.duration*100;draw();}},50);

// Rotary controls support vertical pointer dragging; native sliders remain keyboard accessible.
document.querySelectorAll('.knob').forEach(knob=>{const input=knob.parentElement.querySelector('input');let originY,originValue;knob.onpointerdown=e=>{originY=e.clientY;originValue=Number(input.value);knob.setPointerCapture(e.pointerId);input.focus();};knob.onpointermove=e=>{if(!knob.hasPointerCapture(e.pointerId))return;input.value=Math.round(originValue+(originY-e.clientY)*(Number(input.max)-Number(input.min))/140);input.dispatchEvent(new Event('input'));};knob.onpointerup=e=>{if(knob.hasPointerCapture(e.pointerId))knob.releasePointerCapture(e.pointerId);};});
