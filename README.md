# slz-form-event

> ⚠️ **Draft / POC** — cette lib n'existe pas encore en tant que package publié. Ce repo est un terrain d'expérimentation pour valider l'API et l'architecture avant extraction.

## Architecture — packages

`slz-form-event` est le **cœur agnostique** de l'écosystème. Il ne dépend d'aucun framework et porte toute la logique métier : state machine des champs, cycle de vie, behaviors, validators, orchestration async.

Au-dessus de ce core, chaque framework dispose de son propre **adapter** :

| Package | Framework | Rôle |
|---|---|---|
| **`slz-form-event`** *(ce repo)* | — | Core agnostique, zéro dépendance framework |
| `slz-react-form-event` | React | Adapter React (hooks, `useSyncExternalStore`, composants) |
| `slz-angular-form-event` | Angular | Adapter Angular (services, directives, signals) |
| `slz-vue-form-event` | Vue.js | Adapter Vue (composables, directives) |

Ce découpage garantit que la logique n'est écrite qu'une fois dans le core et que chaque adapter se limite au pont framework ↔ core, sans dupliquer de comportement.

## À quoi ça sert

`slz-form-event` vise à éliminer le code répétitif qu'on réécrit à chaque fois qu'on construit un input dans une application frontend : gestion du `value`/`onChange`, du `touched`/`blur`, de l'état de validation (pristine / loading / valid / error), du verrouillage pendant un appel async, du prefill depuis une API, du spinner, du `disabled` pendant la soumission, etc.

L'idée : déclarer **ce que le champ est** et **les comportements qu'on lui branche** (validation, prefill, lock, fetch d'options…), et laisser le core orchestrer le reste, quel que soit le framework utilisé côté consommateur.

## Philosophie

- **Agnostique** : le core ne sait pas ce qu'est React, Angular ou Vue. Il expose uniquement des classes et des interfaces framework-indépendantes.
- **Déclaratif** : on décrit le champ avec des options, pas avec du state local éparpillé dans le composant parent.
- **Fermé à la modification, ouvert à l'extension** (OCP) : le cœur (`FieldController`, behaviors, validators) ne bouge pas ; on étend en **pluggant des behaviors** (`IBehavior`) ou des validateurs (`IValidator`) — exemples actuels : `DefaultBehavior`, `lockWhileLoading`, `lockedFetchBehavior`, `prefillBehavior`, `DebouncedValidator`, `DelayedValidator`.
- **Pas de re-render parasite** : le core expose un store externe observable ; chaque adapter framework souscrit uniquement aux portions de state nécessaires, ce qui évite les re-renders globaux côté consommateur.

## Architecture interne

```
slz-form-event (core agnostique)
│
├── FieldController      ← state machine, lifecycle, behaviors, validator
├── IBehavior / IValidator  ← contrats d'extension
└── Store observable     ← émission des changements sans couplage framework

        │  consommé par l'adapter
        ▼

slz-react-form-event (adapter React)
│
├── useField             ← bridge React (useSyncExternalStore + événements)
├── useTextField / useSelectField / …  ← wrappers par type de champ
└── TextField / SelectField / …        ← composants présentationnels (MUI)
```

Côté consommateur React (via `slz-react-form-event`), ça donne :

```tsx
<SelectField
    formId={FORM_1.id}
    name="cardType"
    label="Card type"
    optionsFetcher={fakeFetchOptions}     // fetch async géré par la lib
    defaultValue="mastercard"              // pré-sélection après fetch
    validator={cardValidator}
    behaviors={[new DefaultBehavior()]}
    required
/>
```

Pas de `useState` d'options, pas de `useEffect` de fetch, pas de gestion manuelle du spinner ou du `disabled` côté parent — tout est encapsulé dans le core et surfacé par l'adapter.

## Objectif

Réduire encore la verbosité côté consommateur : à terme, les `behaviors` / `validator` les plus courants seront soit auto-câblés via des presets, soit déductibles du type de champ et de ses props. L'API publique doit tendre vers une déclaration minimale, sans sacrifier l'extensibilité — et ce quelle que soit la couche framework utilisée.

## Prérequis

- **Node.js ≥ 20.19** (requis par Vite 8 et les `@types/node` 24).
- **npm** (gestionnaire de paquets utilisé sur ce repo).

## Lancer le POC en local

```bash
npm install
npm run dev
```

Build :

```bash
npm run build
```

Lint :

```bash
npm run lint
```

## Auteur

[@elhabibmhadjou-slz](https://github.com/elhabibmhadjou-slz)
