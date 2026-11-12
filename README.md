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

Le master est ramené au niveau RMS de l’original si les crêtes le permettent, avec un plafond de crête échantillon de −1 dBFS. Ce n’est pas une mesure LUFS ni un limiteur true peak. Le preset Streaming est un point de départ tonal, pas une certification de niveau pour les plateformes. Le moteur utilise Web Audio et ne reproduit pas les algorithmes propriétaires de Mixea. Pas de modèle IA dans cette version.

Les fichiers et réglages ne sont pas sauvegardés après rechargement. L’export contient le master, même pendant l’écoute de l’original.

## Espace disque

Conserver le code et les dépendances de développement. Supprimer dist, test-results et les caches temporaires après vérification. Ne jamais versionner les fichiers audio utilisateur.
