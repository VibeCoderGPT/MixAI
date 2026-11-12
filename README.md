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

Import mono/stéréo, maximum 80 Mo et 5 minutes, formats décodables par le navigateur. Six presets éditables, égalisation, compression, largeur stéréo, lecture et comparaison, export WAV PCM 16 bits à la fréquence du fichier décodé.

Le master vise −14 LUFS intégrés avec pondération K et portes de mesure BS.1770. Le gain est suivi d’un limiteur stéréo lié avec anticipation de 5 ms et relâchement de 80 ms. Une reconstruction sinc à quatre phases estime les crêtes inter-échantillons ; une marge de 0,2 dB sous le plafond −1 dBTP protège l’export. Le traitement tourne dans un worker. Le niveau réellement obtenu est affiché ; la cible n’est pas garantie pour le silence, les extraits trop courts ou les signaux extrêmes (gain limité à +30 dB). Les tests comparent des exports WAV à FFmpeg à 44,1 et 48 kHz ; ils ne constituent pas une certification du mesureur pour tous les signaux. Le master peut être plus fort que l’original dans la comparaison. Pas de modèle IA dans cette version.

Les fichiers et réglages ne sont pas sauvegardés après rechargement. L’export contient le master, même pendant l’écoute de l’original.

## Espace disque

Conserver le code et les dépendances de développement. Supprimer dist, test-results et les caches temporaires après vérification. Ne jamais versionner les fichiers audio utilisateur.

Le gain master (−12 à +12 dB) s’applique après la normalisation de base et avant une nouvelle limitation des crêtes. Une valeur positive peut donc dépasser −14 LUFS tout en conservant le plafond true peak. La forme d’onde suit le tampon écouté (Original ou Master) et se met à jour quand le traitement différé termine. Les presets conservent le gain master ; Réinitialiser le remet à zéro.
