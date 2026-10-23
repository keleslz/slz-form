---
id: engine-errors
title: Les erreurs du moteur
sidebar_position: 7
description: Où va une erreur levée par le code de vos behaviors ou validators — form.engineErrors, hook-error et guard-violation.
---

# Les erreurs du moteur

Quand **votre code** lève une erreur à l'intérieur du moteur — un hook de
behavior échoue, une règle de validation casse, une garde du moteur est
enfreinte —, personne n'est là pour l'attraper : la promesse qui la porte n'est
attendue par personne. Le moteur l'attrape, garde le formulaire en état de
marche et l'enregistre sur le formulaire. Il **n'écrit jamais dans la
console**.

Vous lisez ces enregistrements quand vous avez une raison de le faire — après
une soumission refusée, dans un panneau de diagnostic, dans un test :

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::caution Les helpers prêts à l'emploi gèrent leurs propres pannes
`prefill`, `lookup`, `loadOptions` et `suggest` attrapent eux-mêmes l'échec de
leur `fetch` : **rien** n'arrive dans `engineErrors`.

- `prefill` et `lookup` laissent la valeur inchangée et repassent à `idle` ;
- `loadOptions` et `suggest` publient une liste d'options vide ; `loadOptions`
  appelle aussi son option `onError`, si vous en avez donné une.

Pour être informé de ces pannes, attrapez l'erreur dans votre `fetch`, ou
utilisez `onError` :

```ts
import { behaviorsFor } from "slz-form";

const { loadOptions } = behaviorsFor(form);

const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),
    onError: (error) => reportToSentry(error),
});
```

Ce qu'enregistre `engineErrors`, c'est ce que **vos propres** hooks de behavior
et validators lèvent ou rejettent.
:::

:::warning Ce n'est pas ainsi qu'on lit les erreurs de validation
Une valeur refusée par une règle n'est pas une erreur du moteur : lisez-la avec
`field.snapshot.errors`, `field.snapshot.issues` ou `field.hasFlag("error")`.
`engineErrors` ne contient que ce qui a **levé une erreur**.
:::

## Ce que contient un enregistrement

| Propriété | Ce qu'elle dit |
|---|---|
| `scope` | où c'est arrivé : `"behavior"` ou `"validator"` |
| `kind` | `"hook-error"` (votre code a levé) ou `"guard-violation"` (une garde du moteur a été enfreinte) |
| `field` | le champ concerné |
| `rule` | le nom de classe de la règle qui a échoué (`constructor.name`) — enregistrements de validator uniquement. Si la règle est enveloppée dans un `DebouncedValidator`, c'est `"DebouncedValidator"`. Un minifieur peut renommer les classes dans un build de production |
| `error` | la valeur levée, intacte |
| `at` | le moment de l'enregistrement (`Date.now()`) |

## Votre code, ou la façon d'utiliser l'API ?

`kind` vous dit où chercher :

- **`hook-error`** : **votre** code a levé — une panne réseau, une réponse
  illisible, un bug ;
- **`guard-violation`** : le **moteur** a refusé quelque chose — par exemple un
  behavior qui appelle `mark("error")` avec un mot réservé au moteur.

```ts
const misuses = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

Un refus du moteur est une `EngineGuardError`, qui est exportée :
`err.error instanceof EngineGuardError` donne la même réponse que `kind`.

:::caution Classement actuel
Lire un champ avec `ctx.watched()` sans l'avoir déclaré dans `watch` est un
mauvais usage de l'API, mais il est aujourd'hui enregistré comme `hook-error` —
sauf dans un tableau de validators, où c'est un `guard-violation`. Et une règle
de validation qui lève **de façon synchrone** est enregistrée avec
`scope: "behavior"` et sans `rule` (voir
[Une passe interrompue](../model/interrupted-pass.md)). Ne comptez pas sur
`kind` ou `scope` seuls pour les retrouver.
:::

## Une règle qui casse

```ts
import { IValidator, type ValidationReport } from "slz-form";

class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // the network fails here
        report.errorIf(taken, "Already taken");
    }
}
```

Deux choses se produisent, à deux endroits :

- le champ reçoit un constat bloquant `"unverified"` — voir
  [Une passe interrompue n'est pas un verdict](../model/interrupted-pass.md) ;
- `form.engineErrors` reçoit un enregistrement avec `scope: "validator"` et
  `rule: "Available"`.

Le premier empêche le formulaire de partir ; le second vous dit **pourquoi**.
Dans un tableau de validators, un membre qui casse n'efface pas les constats des
autres : le refus d'une règle saine est conservé.

## Un tampon qu'on lit, pas un événement

`engineErrors` est une propriété, pas un abonnement — il n'existe pas de
`onEngineError`. Une erreur du moteur est une panne dont le moteur s'est déjà
remis : un enregistrement de diagnostic, pas quelque chose à traiter en direct.

- Il est **hors du snapshot** : un nouvel enregistrement ne notifie pas
  `form.listen` et ne provoque aucun rendu. Il n'existe que sur le formulaire,
  jamais sur un champ.
- Il garde les **50 enregistrements les plus récents**.
- `form.reset()` le vide ; la soumission non, si bien qu'une erreur survenue
  pendant une soumission est encore là après.
- Chaque lecture rend une **copie**, du plus ancien au plus récent.

:::note Un validator utilisé hors d'un formulaire reste muet
`validator.handle(value)` appelé à la main, sans formulaire autour, n'a nulle
part où enregistrer une panne : rien n'est enregistré nulle part.
:::
