---
id: hooks
title: Les hooks
sidebar_position: 2
description: useField, useForm, et pourquoi aucun useState ne recopie l'état du moteur.
---

# Les hooks

| Export | Rôle |
|---|---|
| `hooksFor(form)` | rend `useField`, `useFieldArray` et `useForm` liés à un formulaire, typés par sa map |
| `useField` | un champ : valeur, constats, flags, handlers |
| `useFieldArray` | les lignes d'une liste : `rows`, `append`, `remove`, `move`, `clear` |
| `useFieldOn(form, params)` | `useField` lié à un formulaire donné — sert à câbler un champ de ligne |
| `FormProvider` | publie le `FormRegister` dans l'arbre, pour l'accès transverse |
| `useFormRegister` | accès direct au register |

## Lire l'état : deux fonctions

```tsx
field.hasFlag("locked", "required")   // ET  — toutes présentes
field.hasAny("loading", "invisible")  // OU  — au moins une
```

Le formulaire répond aux mêmes deux fonctions, avec les mêmes mots :

```tsx
const { hasFlag, submit } = useForm();

<button disabled={!hasFlag("valid", "idle")} onClick={() => void submit()}>
    Envoyer
</button>
```

:::note `error` au champ et au formulaire ne disent pas la même chose
Au champ, `error` est ce qu'on **affiche** — éteint tant qu'on n'a pas touché,
pour qu'un préremplissage n'allume rien. Au formulaire, `error` est ce qui est
**vrai** : un formulaire prérempli et faux ne part pas. Le verdict d'un champ
pris isolément, c'est `field.errors` non vide.
:::

## Router les messages

`field.issues` porte chaque constat avec sa `severity` et son `code`, ce qui
permet de router sans que le moteur s'en mêle :

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

## `locked` et `readonly` sont distincts

`readonly` est lisible et sélectionnable, mais non modifiable — et n'implique
pas `locked`. La vue peut piloter les deux :
`useField({ name, locked, readOnly })`.

## Aucun `useState` ne recopie l'état du moteur

`useField` ne fait que brancher le cycle de vie React sur le controller et lire
son snapshot via `useSyncExternalStore`. Un champ qui change **ne re-rend pas
les autres** — s'abonner au formulaire entier est un choix explicite, réservé à
ce qui en a besoin : un bouton submit, un récapitulatif.

C'est mesuré, pas affirmé : la démo compte les rendus par champ et affiche
l'écart avec la même vue écrite en `useState`.
