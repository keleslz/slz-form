---
id: hooks
title: Les hooks
sidebar_position: 2
description: useField, useForm et useFieldArray — ce qu'ils prennent, ce qu'ils rendent, et pourquoi aucun useState ne recopie l'état du moteur.
---

# Les hooks

| Export | Rôle |
|---|---|
| `hooksFor(form)` | rend `useField`, `useFieldArray` et `useForm`, liés à `form` et typés par sa map de champs |
| `useField(params)` | un champ : valeur, messages, flags, gestionnaires d'événements |
| `useForm()` | le formulaire entier : flags, valeurs, erreurs, `submit`, `reset` |
| `useFieldArray(name)` | les lignes d'une liste : `rows`, `append`, `remove`, `move`, `clear` |
| `useFieldOn(form, params)` | `useField` pour un formulaire que vous passez — sert aux champs d'une [ligne](./lists.md) |
| `useFieldArrayOn(form, name)` | `useFieldArray` pour un formulaire que vous passez — une liste imbriquée dans une ligne |
| `FormProvider` / `useFormRegister` | placer un `FormRegister` (tous les formulaires de l'application) dans le contexte, et le relire |

## `useField`

```tsx
import { useField } from "./form/signup-form";

const field = useField({ name: "email", required: true, validator: new EmailValidator() });
```

**Ce qu'il prend.** Deux sortes de paramètres, et la différence compte :

| Lus une fois, à la création du champ | Réappliqués chaque fois qu'ils changent |
|---|---|
| `validator`, `behaviors`, `initialValue`, `requiredMessage`, `requiredTrue` | `required`, `locked`, `readOnly`, `options`, `value` |

Écrire `useField({ name, behaviors: [...], validator: new X() })` en ligne dans
un rendu est donc sans risque : une nouvelle instance est construite à chaque
rendu, mais seules les valeurs du premier appel servent, et le champ n'est
jamais reconstruit. Le revers : les changer ensuite n'a aucun effet — les
behaviors et le validator d'un champ sont fixés pour toute sa vie.

`value` rend le champ **contrôlé** par le parent : quand la clé `value` est
présente, le champ la suit — `value: undefined` vide le champ. Omettez la clé
pour un champ que pilote l'utilisateur.

**Ce qu'il rend.**

| Membre | Ce que c'est |
|---|---|
| `name` | le nom du champ |
| `value` | la valeur courante |
| `hasFlag(...)` / `hasAny(...)` / `flags` | les [flags](../model/flags.md) du champ |
| `ui` | les mêmes flags sous forme d'`UiState` (`validity`, `activity`, `markers`) |
| `error` / `errors` / `warnings` / `issues` | les messages du validator — `issues` porte `severity` et `code` |
| `options` | la liste d'options |
| `onChange(value)` / `onBlur()` / `onFocus()` | à brancher sur la saisie |
| `controller` | le `FieldController` sous-jacent, pour tout le reste |

```tsx
field.hasFlag("locked", "required")   // AND — all present
field.hasAny("loading", "invisible")  // OR  — at least one
```

Pour envoyer un message ailleurs que sous le champ, filtrez `issues` sur
`code` :

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

`readonly` et `locked` sont différents : `readonly` est lisible et sélectionnable
mais non modifiable, et n'implique pas `locked`. La vue peut poser l'un ou
l'autre avec `useField({ name, locked, readOnly })`, en plus de ce que posent
les behaviors.

## `useForm`

```tsx
const { hasFlag, submit } = useForm();

<button disabled={hasFlag("submitting")} onClick={() => void submit()}>
    Submit
</button>
```

| Membre | Ce que c'est |
|---|---|
| `hasFlag(...)` / `hasAny(...)` / `flags` | les flags du formulaire : `valid` · `error`, `idle` · `submitting` · `submitted`, `loading`, `touched` |
| `values` | le payload, comme `form.values()` |
| `errors` | les messages bloquants, indexés par nom de champ |
| `snapshot` | le `FormSnapshot` complet, dont `snapshot.arrays` pour les listes |
| `submit()` | la [porte de soumission](../guides/submit.md) — `Promise<boolean>` |
| `reset()` | fait repartir le formulaire de zéro |

:::note `error` ne dit pas la même chose sur un champ et sur le formulaire
Sur un champ, `error` est ce qu'on **affiche** — éteint tant que le champ n'a pas
été touché, pour qu'une valeur préremplie n'allume rien. Sur le formulaire,
`error` est ce qui est **vrai** : un formulaire prérempli et invalide ne part
pas. Pour savoir si la valeur d'un champ est refusée, lisez ses `errors`. Voir
[Les flags](../model/flags.md#displayed-versus-true).
:::

:::caution Deux choses à savoir sur `useForm`
- La garde `!hasFlag("valid", "idle")` reste désactivée après une soumission
  réussie, jusqu'à `reset()` : le formulaire reste `submitted` jusqu'à `reset()`
  ou au `submit()` suivant, et c'est ce bouton-là qui l'appellerait. Voir
  [Quelle garde pour le bouton](../guides/submit.md#which-guard-for-the-button).
- Un composant qui appelle `useForm()` appelle `form.mount()` à son montage, et
  cela monte **tous** les champs créés jusque-là sur le formulaire — y compris un
  champ dont le composant a été démonté entre-temps, qui revient alors dans
  `values()` et dans le verdict. Cela se produit à chaque montage de ce
  composant — un rendu conditionnel, un changement de route, une nouvelle
  `key`. Gardez le composant qui appelle `useForm()` monté tant que le
  formulaire est utilisé.
:::

## Aucun `useState` ne recopie l'état du moteur

`useField` ne fait que relier le cycle de vie du composant au champ et lire son
snapshot par `useSyncExternalStore`. Un champ qui change **ne re-rend pas les
autres**. S'abonner au formulaire entier avec `useForm()` est un choix explicite,
pour les composants qui en ont besoin : un bouton de soumission, un
récapitulatif.

C'est mesuré, pas seulement affirmé : la démo compte les rendus par champ et
montre l'écart avec la même vue écrite avec `useState`.

## `FormProvider` et `useFormRegister` {#formprovider-and-useformregister}

Dans le cas courant, vous n'en avez pas besoin : `hooksFor(form)` lie déjà les
hooks au formulaire. Ils servent aux outils transverses — un panneau de
diagnostic qui liste tous les formulaires, par exemple :

```tsx
import { FormRegister } from "slz-form";
import { FormProvider } from "slz-react-form";

const formRegister = new FormRegister({ values: [signupForm, invoiceForm] });

<FormProvider register={formRegister}><App /></FormProvider>
```

`useFormRegister()` rend ce registre : `names()`, `get(name)`, `require(name)`,
`snapshots()`, `listen(callback)`.

:::caution Écart connu : le registre n'est pas typé par la map de champs
`register.get(name)` et `register.require(name)` rendent aujourd'hui un
formulaire dont la map de champs est perdue : `.field("email")` dessus ne
compile pas. C'est une limite du typage, pas l'usage voulu du registre. En
attendant le correctif, utilisez le registre pour lister les formulaires et lire
leurs snapshots, et importez le module propre au formulaire pour travailler
avec ses champs.
:::
