# react-slz-form

> ⚠️ **Draft / POC** — cette lib n'existe pas encore en tant que package publié. Ce repo est un terrain d'expérimentation pour valider l'API et l'architecture avant extraction.

## À quoi ça sert

`react-slz-form` vise à éliminer le code répétitif qu'on réécrit à chaque fois qu'on construit un input dans une application React : gestion du `value`/`onChange`, du `touched`/`blur`, de l'état de validation (pristine / loading / valid / error), du verrouillage pendant un appel async, du prefill depuis une API, du spinner, du `disabled` pendant la soumission, etc.

L'idée : déclarer **ce que le champ est** (un `TextField`, un `SelectField`, …) et **les comportements qu'on lui branche** (validation, prefill, lock, fetch d'options…), et laisser la lib orchestrer le reste.

## Philosophie

- **Déclaratif** : on décrit le champ avec des props, pas avec du state local éparpillé dans le composant parent.
- **Fermé à la modification, ouvert à l'extension** (OCP) : le cœur (`FieldController`, hooks, composants) ne bouge pas ; on étend en **pluggant des comportements** (`IBehavior`) ou des validateurs (`IValidator`) — exemples actuels : `DefaultBehavior`, `lockWhileLoading`, `lockedFetchBehavior`, `prefillBehavior`, `DebouncedValidator`, `DelayedValidator`.
- **Pas de re-render parasite** : plus besoin de wrapper chaque input dans un sous-composant `memo` côté consommateur pour isoler les re-renders. Chaque champ embarque son propre store externe via `useSyncExternalStore`, et son state contextuel (ex. les options async d'un `SelectField`) vit **dans son hook dédié** (`useSelectField`, `useTextField`, …), pas dans le parent.

## Comment ça marche aujourd'hui

Trois couches :

```
FieldController              ← orchestrateur framework-agnostic
                               (state machine, lifecycle, behaviors, validator)
        │
        ▼
useField                     ← bridge React/Redux générique
                               (useSyncExternalStore + mount/unmount/change/blur)
        │
        ▼
useTextField / useSelectField / …   ← wrappers par type de champ
                                       (logique contextuelle : options async, defaultValue, …)
        │
        ▼
TextField / SelectField / …  ← composants purement présentationnels (MUI)
```

Côté consommateur, ça donne :

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

Pas de `useState` d'options, pas de `useEffect` de fetch, pas de gestion manuelle du spinner ou du `disabled` côté parent — tout est encapsulé.

## Objectif

Réduire encore la verbosité côté consommateur : à terme, les `behaviors` / `validator` les plus courants seront soit auto-câblés via des presets, soit déductibles du type de champ et de ses props. L'API publique doit tendre vers une déclaration minimale, sans sacrifier l'extensibilité.

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
