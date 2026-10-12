---
id: engine-errors
title: Les erreurs du moteur
sidebar_position: 6
description: Ce que devient un hook ou une règle qui lève — form.engineErrors, hook-error et guard-violation.
---

# Les erreurs du moteur

Le moteur **ne loggue jamais**. Quand un hook de behavior rejette, qu'une règle
de validation casse ou qu'une garde du moteur est violée, l'erreur n'a personne
à qui remonter : la promesse qui la porte n'est attendue par personne. Plutôt
que de l'écrire dans la console, le moteur la **route** vers le formulaire.

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::warning Ce n'est pas ainsi qu'on lit une erreur de validation
Un champ qui échoue à ses règles n'est pas une erreur du moteur : il se lit par
`field.errors`, `field.issues` ou `field.hasFlag("error")`. `engineErrors` ne
contient que ce qui a **levé**.
:::

## Ce que porte une erreur

| Champ | Ce qu'il dit |
|---|---|
| `scope` | d'où elle vient : `"behavior"` ou `"validator"` |
| `kind` | sa nature : `"hook-error"` ou `"guard-violation"` |
| `field` | le champ où elle s'est produite |
| `rule` | le nom de la règle ou du membre fautif — côté validator uniquement |
| `error` | l'objet levé, tel quel : le moteur ne l'interprète pas |
| `at` | l'horodatage de la capture (`Date.now()`) |

## Votre code, ou votre usage de l'API ?

`kind` sépare les deux, et c'est ce qui dit où chercher.

- **`hook-error`** — **votre** code a levé : un réseau tombé, une réponse
  illisible, un bug applicatif.
- **`guard-violation`** — le **moteur** a levé, parce qu'un contrat a été
  enfreint : un flag réservé posé par `mark`, un champ lu sans avoir été déclaré
  dans `watch`.

```ts
const bugs = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

Une garde lève une `EngineGuardError`, exportée : `err.error instanceof
EngineGuardError` donne la même réponse que `kind`.

## Une règle qui casse

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // le réseau tombe ici
        report.errorIf(taken, "Déjà pris");
    }
}
```

Deux choses se produisent, sur deux surfaces distinctes :

- le champ devient **non vérifié, et bloquant** — voir
  [Une passe interrompue n'est pas un verdict](../model/interrupted-pass.md) ;
- l'erreur atterrit dans `form.engineErrors`, avec `scope: "validator"` et
  `rule: "Available"`.

La première dit à l'utilisateur que le formulaire ne peut pas partir ; la
seconde vous dit **pourquoi**. Dans un tableau de validators, un membre qui
casse n'emporte pas le constat d'un autre : le refus d'une règle saine survit.

## Un tampon qu'on lit, pas un événement

`engineErrors` est un accesseur, pas un abonnement — il n'y a pas de
`onEngineError`. Une erreur du moteur est un crash **déjà rattrapé** : un
enregistrement de diagnostic, pas un événement à traiter en temps réel. On le
lit quand on a une raison de le faire — après un `submit()` refusé, dans un
panneau de debug, dans un test.

- Il est **hors du snapshot** : ce n'est pas de l'état de rendu, y écrire ne
  re-rend rien, et il n'existe qu'au formulaire — jamais sur un champ.
- Il est **borné** aux 50 erreurs les plus récentes.
- `reset()` le vide. La soumission le laisse intact, pour qu'une erreur survenue
  en soumettant reste lisible après coup.
- Chaque lecture rend une **copie**, des plus anciennes aux plus récentes.

:::note Un validator appelé hors d'un formulaire se tait
`validator.handle(value)` appelé à la main n'a aucun formulaire vers lequel
router. S'il casse, rien n'est enregistré nulle part — angle mort assumé.
:::
