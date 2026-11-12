# MixAI

Studio de mastering web en français. Les fichiers audio restent dans le navigateur.

## Développement

Node.js 22 ou supérieur.

```sh
npm ci --cache /tmp/mixai-npm
npm run dev
```

Dans un autre terminal : `npm test` (Chromium installé à `/usr/bin/chromium`).
Compilation : `npm run build`.

## Première version

Import mono/stéréo, maximum 80 Mo et 5 minutes, formats décodables par le navigateur. Six presets éditables, égalisation, compression, largeur stéréo, lecture et comparaison, export WAV PCM 24 bits avec dither TPDF à la fréquence du fichier décodé.

Aucune normalisation LUFS automatique. Le gain master est appliqué au signal traité avant un limiteur stéréo lié (anticipation 5 ms, relâchement 80 ms). Le plafond est −2 dBTP avec une marge de sécurité de 0,2 dB et une estimation sinc à quatre phases. Les LUFS sont mesurés, sans cible imposée. Sous le plafond, les réglages neutres et le gain à zéro préservent le niveau ; les presets peuvent modifier la dynamique. Les mesures des exports sont comparées à FFmpeg à 44,1 et 48 kHz, sans prétendre à une certification pour tous les signaux.

Les fichiers et réglages ne sont pas sauvegardés après rechargement. L’export contient le master, même pendant l’écoute de l’original.

## Espace disque

Conserver le code et les dépendances de développement. Supprimer dist, test-results et les caches temporaires après vérification. Ne jamais versionner les fichiers audio utilisateur.

Le gain master (−12 à +12 dB) précède la limitation des crêtes. Le signal avant limitation est mis en cache pour les changements de gain. La forme d’onde montre Original ou Master ; un indicateur apparaît pendant le calcul. Les presets conservent le gain master ; Réinitialiser le remet à zéro.

Intensité : 0 % laisse le signal inchangé à cette étape ; 100 % ajoute 6 dB avant le limiteur final, en plus du gain master. Le compresseur Web Audio à compensation automatique est retiré. Cette commande augmente la densité via la limitation ; elle peut atteindre un plateau sur un morceau déjà fortement limité. Les changements d’intensité réutilisent le même cache que le gain master.
