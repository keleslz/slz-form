---
id: installation
title: Installation
sidebar_position: 2
description: Installer les packages, ou lancer la démo depuis le dépôt.
---

# Installation

**Prérequis :** Node.js ≥ 20.19, npm.

## Dans votre application

```bash
npm install slz-form slz-react-form
```

:::warning Pré-publication
Rien n'est encore sur npm. Les noms `slz-form`, `slz-react-form`,
`slz-angular-form` et `slz-vue-form` sont libres, et l'API peut encore bouger.
:::

Le moteur seul suffit si vous n'utilisez pas React :

```bash
npm install slz-form
```

`slz-form` n'a **aucune dépendance** et n'expose que de l'**ESM** — pas de build
CommonJS.

### Une seule copie de chaque

`slz-form` et `react` sont des **peer dependencies** de l'adapter : votre
application doit en résoudre une seule copie de chaque.

Deux copies de React cassent les hooks. Deux copies de `slz-form` cassent le
test `instanceof BehaviorState` du moteur — et les flags sont alors
**silencieusement** ignorés, ce qui est bien pire qu'une erreur. Si un behavior
semble n'avoir aucun effet, vérifiez d'abord ce point.

## Depuis le dépôt

```bash
git clone https://github.com/keleslz/slz-form-event.git
cd slz-form-event
npm install     # workspaces npm : tout est lié localement
npm run dev     # ouvre la démo React
```

La démo monte **tous les types de champ dans une seule vue** — texte, email,
textarea, nombre, select, select dépendant, multi-select, radio, checkbox,
fichier, date, heure, datetime, champ conditionnel, champ prérempli. Un onglet
montre l'implémentation avec le moteur, l'autre la même chose écrite en
`useState`, et un compteur de rendus par champ rend l'écart visible.

En développement, la démo pointe vers les **sources** des packages : modifier le
moteur recharge la démo à chaud, sans rebuild.

### Les vérifications

```bash
npm run typecheck      # les 3 workspaces
npm run lint
npm test               # tests unitaires du moteur
npm run test:e2e       # la démo dans un vrai navigateur
npm run build          # packages (tsup) puis démo (vite)
```

La CI rejoue tout cela sur chaque PR, plus le contenu réellement publié
(`npm pack --dry-run`).

## Le site de documentation

Il vit dans `website/`, **hors** des workspaces npm — Docusaurus tire beaucoup
de dépendances, et les jobs de CI du moteur n'ont pas à les payer.

```bash
npm install            # à la racine d'abord : TypeDoc lit les sources par ce chemin
cd website
npm install
npm start
```
