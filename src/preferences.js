const pairs={
'Préréglages':'Presets','Studio de mastering':'Mastering studio','Déposez votre chanson ici':'Drop your track here','ou cliquez pour choisir un fichier':'or click to choose a file','WAV, MP3, FLAC, M4A · jusqu’à 80 Mo et 5 minutes':'WAV, MP3, FLAC, M4A · up to 80 MB and 5 minutes','Remplacer':'Replace','Votre forme d’onde apparaîtra ici':'Your waveform will appear here','Mise à jour du son…':'Updating audio…','Gain ajustable · sans normalisation':'Adjustable gain · no normalization','Plafond −2 dBTP':'−2 dBTP ceiling','CRÊTE TRUE PEAK':'TRUE PEAK','VOLUME INTÉGRÉ':'INTEGRATED LOUDNESS','Couleur du son':'Sound character','Équilibré':'Balanced','Basses profondes':'Deep bass','Voix claire':'Clear vocals','Doux':'Smooth','Intensité':'Intensity','Basses':'Bass','Clarté':'Clarity','Chaleur':'Warmth','Largeur stéréo':'Stereo width','Compression · niveau compensé · 0 % = désactivée':'Compression · level compensated · 0% = off','Le poids du bas du spectre':'Weight in the low end','La présence des voix et des détails':'Vocal presence and detail','Du corps dans les bas médiums':'Body in the low mids','L’espace entre la gauche et la droite':'Space between left and right','Gain master':'Master gain','Gain avant limitation · plafond −2 dBTP':'Gain before limiting · −2 dBTP ceiling','Calcul du master… L’écoute conserve le dernier réglage prêt.':'Processing master… Playback keeps the last ready result.','↺ Réinitialiser les réglages':'↺ Reset settings','Personnalisé':'Custom','Exporter':'Export','Préparation de votre master…':'Processing your master…','Lecture du fichier…':'Reading file…','Ce fichier dépasse 80 Mo. Choisissez une version plus légère.':'This file exceeds 80 MB. Choose a smaller file.','Limite de 5 minutes par morceau.':'Maximum 5 minutes per track.','Choisissez un fichier mono ou stéréo.':'Choose a mono or stereo file.','Ce fichier audio est illisible. Essayez un WAV ou un MP3.':'Cannot read this audio file. Try WAV or MP3.','Mise à jour impossible. Le dernier master reste disponible. Réessayez.':'Update failed. The previous master is still available. Try again.','Échec de l’export. Réessayez.':'Export failed. Please try again.','Format d’export':'Export format','WAV · 24 bits':'WAV · 24-bit','MP3 · 192 kb/s · compact':'MP3 · 192 kbps · compact','MP3 · 320 kb/s · qualité':'MP3 · 320 kbps · quality','MixAI accueil':'MixAI home','Forme d’onde du morceau':'Track waveform','Mise à jour de la forme d’onde':'Updating waveform','Position de lecture':'Playback position','Lire':'Play','Comparaison':'Comparison','Traitement du master en cours':'Processing master','Mode clair':'Light mode','Mode sombre':'Dark mode','Sélectionné · molette pour ajuster · Entrée pour confirmer · Échap pour annuler':'Selected · scroll to adjust · Enter to confirm · Escape to cancel'
};
const reverse=Object.fromEntries(Object.entries(pairs).map(([a,b])=>[b,a]));
function translate(text,lang){
 const trimmed=text.trim(),original=reverse[trimmed]||trimmed;
 let value=lang==='en'?(pairs[original]||original):original;
 if(original.startsWith('Master prêt · gain '))value=lang==='en'?original.replace('Master prêt · gain ','Master ready · gain ').replace('plafond','ceiling'):original;
 if(trimmed.startsWith('Master ready · gain '))value=lang==='fr'?trimmed.replace('Master ready · gain ','Master prêt · gain ').replace('ceiling','plafond'):trimmed;
 if(/^(Exportation|Exporting) /.test(trimmed))value=trimmed.replace(/^(Exportation|Exporting)/,lang==='en'?'Exporting':'Exportation');
 if(/^(Téléchargé|Downloaded) :/.test(trimmed))value=trimmed.replace(/^(Téléchargé|Downloaded)/,lang==='en'?'Downloaded':'Téléchargé');
 if(/^\d+:\d+ ·/.test(trimmed))value=lang==='en'?trimmed.replace('Stéréo','Stereo').replace(' Mo',' MB'):trimmed.replace('Stereo','Stéréo').replace(' MB',' Mo');
 return text.replace(trimmed,value);
}
export function setupPreferences(){
 let lang;try{lang=localStorage.getItem('mixai-language')==='fr'?'fr':'en';}catch{lang='en';}
 let theme;try{theme=localStorage.getItem('mixai-theme')==='light'?'light':'dark';}catch{theme='dark';}
 const root=document.querySelector('#app'),language=document.querySelector('#language'),toggle=document.querySelector('#theme');
 const apply=()=>{
  observer.disconnect();document.documentElement.lang=lang;document.documentElement.dataset.theme=theme;language.textContent=lang==='en'?'EN / FR':'FR / EN';toggle.textContent=translate(theme==='dark'?'Mode clair':'Mode sombre',lang);toggle.setAttribute('aria-pressed',theme==='light');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){if(node.parentElement.closest('#filename,#language,#theme,script,style'))continue;const next=translate(node.textContent,lang);if(next!==node.textContent)node.textContent=next;}
  for(const attribute of ['aria-label','title'])root.querySelectorAll('['+attribute+']').forEach(el=>{const value=translate(el.getAttribute(attribute),lang);if(value!==el.getAttribute(attribute))el.setAttribute(attribute,value);});
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label']});
 };
 const observer=new MutationObserver(apply);
 language.onclick=()=>{lang=lang==='en'?'fr':'en';try{localStorage.setItem('mixai-language',lang);}catch{}apply();};
 toggle.onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('mixai-theme',theme);}catch{}apply();};apply();
}
