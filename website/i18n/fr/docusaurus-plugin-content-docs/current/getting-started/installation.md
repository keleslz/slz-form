---
id: installation
title: Installation
sidebar_position: 2
description: Installer les packages dans une application ou lancer la démo depuis le dépôt.
---

# Installation

Cette page explique comment préparer votre application, lancer la démo React et démarrer le site de documentation. Vous y trouverez aussi les commandes de vérification du dépôt.

Vous avez besoin de Node.js ≥ 20.19 et de npm. Activez `strict: true` dans TypeScript pour vérifier les noms de champs et les valeurs avec les types prévus.

## Dans votre application

La commande d'installation dans une application est :

```bash
npm install slz-form slz-react-form
```

:::warning Pré-publication
L'API peut encore changer. Pour essayer le code actuel pendant le développement, suivez les instructions pour le dépôt ci-dessous. Les commandes d'installation utilisent les noms `slz-form` et `slz-react-form` ; leur disponibilité sur npm dépend de leur publication. Les noms `slz-angular-form` et `slz-vue-form` ne signifient pas que ces adaptateurs sont inclus dans ce dépôt.
:::

Si vous utilisez le cœur sans React, seul ce package est nécessaire :

```bash
npm install slz-form
```

`slz-form` n'a aucune dépendance à l'exécution. Il fournit de l'ESM, sans build CommonJS.

### Une seule copie de chaque

L'adaptateur React déclare `slz-form` et React ≥ 18 comme peer dependencies : votre application les fournit. Assurez-vous qu'elle résout une seule copie de chacun.

Plusieurs copies de React peuvent casser les hooks. Le moteur vérifie aussi les résultats des behaviors avec `instanceof BehaviorState`. `BehaviorState` est l'objet qu'un behavior renvoie pour décrire son état de chargement et ses flags. Un résultat créé par une autre copie de `slz-form` échoue à cette vérification et peut être ignoré sans erreur. Vérifiez la résolution des dépendances si un behavior semble sans effet.

## Depuis le dépôt

```bash
git clone https://github.com/keleslz/slz-form.git
cd slz-form
npm install     # workspaces npm : tout est lié localement
npm run dev     # ouvre la démo React
```

Les workspaces npm relient les packages localement. La démo rassemble dans une vue les champs texte, email, textarea, nombre, select, select dépendant, multi-select, radio, checkbox, fichier, date, heure, datetime, conditionnels et préremplis.

Un onglet utilise le moteur ; un autre implémente la même vue avec `useState`. Un compteur à côté de chaque champ indique le nombre de rendus. En développement, la démo importe les sources des packages : les modifications du moteur apparaissent par rechargement à chaud, sans reconstruire les packages.

### Les vérifications

```bash
npm run typecheck      # les 3 workspaces
npm run lint
npm test               # tests unitaires du moteur
npm run test:e2e       # la démo dans un vrai navigateur
npm run build          # packages (tsup) puis démo (vite)
```

La CI exécute ces vérifications sur les pull requests. Elle vérifie aussi le contenu des packages avec `npm pack --dry-run`.

## Le site de documentation

Le site Docusaurus se trouve dans `website/`, en dehors des workspaces npm. Ses dépendances sont installées séparément ; les vérifications des packages ne demandent donc pas d'installer le site.

Installez d'abord les dépendances à la racine : TypeDoc en a besoin pour résoudre les imports lors de la génération de la référence API depuis les sources.

```bash
npm install            # à la racine d'abord : TypeDoc lit les sources par ce chemin
cd website
npm install
npm start
```
