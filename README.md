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

Intensité contrôle un compresseur stéréo lié : seuil de −12 à −30 dBFS, ratio de 1:1 à 4:1, coude doux 6 dB, attaque 15 ms et relâchement 150 ms. À 0 %, cette étape est désactivée. Le niveau intégré avant compression est compensé après traitement (compensation plafonnée à 18 dB), sans cible LUFS imposée. Le gain master indépendant et le limiteur −2 dBTP suivent cette étape. Le limiteur peut réduire le niveau final si les crêtes l’exigent ; une hausse d’intensité ne garantit pas une hausse du volume.

## Interface et exports

Anglais et thème sombre par défaut ; langue FR/EN et thème clair/sombre mémorisés dans le navigateur. Une seule interface responsive : disposition compacte sur PC et disposition tactile sur mobile. Limite d’import inchangée : 5 minutes / 80 Mo.

Sur PC : Espace active lecture/pause hors champs et boutons. Cliquer un réglage pour sélectionner, utiliser la molette au-dessus pour ajuster, cliquer à nouveau ou Entrée pour confirmer ; Échap restaure la valeur lors de la sélection. Les sliders et gestes tactiles restent disponibles.

Export WAV PCM 24 bits avec dither ou MP3 à 192/320 kb/s. MP3 est un format avec pertes, plus compact ; sa conversion peut modifier les crêtes reconstruites. Le plafond du master PCM n’est pas une certification du MP3 décodé. L’encodage tourne dans un worker avec progression et capture les réglages prêts au moment du clic. LAME fonctionne à 32/44,1/48 kHz ; les autres fréquences sont converties à 48 kHz pour MP3. Notices et module original : public/licenses/.
