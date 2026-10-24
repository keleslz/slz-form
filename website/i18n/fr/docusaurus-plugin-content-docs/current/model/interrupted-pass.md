---
id: interrupted-pass
title: Une passe interrompue n'est pas un verdict
sidebar_position: 3
description: Ce que publie le moteur quand une règle casse, pourquoi ce n'est ni « valide » ni le verdict précédent, et comment se termine l'attente (`loading`) d'un behavior.
---

# Une passe interrompue n'est pas un verdict

Une **passe**, c'est une exécution d'un validator sur une valeur — toutes les
règles qu'il contient —, ou un appel d'un hook de behavior. Une passe est
**interrompue** quand elle ne peut pas aller au bout : une règle lève une
erreur, un appel réseau échoue.

Le raccourci tentant, c'est *« la passe s'est terminée, donc j'ai un
verdict »*. Il est faux dès qu'une règle casse. Voici ce que publie le moteur :

| La passe du validator | Ce que reçoit le champ |
|---|---|
| complète | le verdict : `valid`, ou `error` avec les constats trouvés |
| interrompue, après qu'une autre règle a refusé la valeur | ce refus — il vient d'une règle qui, elle, a conclu |
| interrompue, sans aucun refus | un constat bloquant de `code: "unverified"` (message : `"Validation unavailable"`) |

Un réseau tombé n'est pas un verdict. Personne n'a jugé la valeur, et la
déclarer valide laisserait passer ce que la règle aurait peut-être refusé.
Garder le verdict précédent serait faux aussi : il a été rendu sur *une autre*
valeur.

La panne elle-même est enregistrée dans `form.engineErrors`, avec
`scope: "validator"` et le nom de la règle — voir
[Les erreurs du moteur](../guides/engine-errors.md).

:::caution Écarts connus de la version actuelle
Deux cas ne suivent pas encore ce tableau :

- **Une règle qui lève de façon synchrone garde le verdict précédent.** Si
  `validate()` n'est pas `async` et lève — `new URL(value)` sur une chaîne
  malformée, `JSON.parse` —, le champ garde le verdict qu'il avait avant, et une
  valeur invalide peut être soumise. La panne est enregistrée avec
  `scope: "behavior"`. Une règle déclarée `async`, ou un membre d'un tableau
  d'au moins deux validators, est traitée comme documenté — un tableau d'un
  seul élément est réduit à la règle seule, et a l'écart. En attendant le
  correctif, attrapez l'erreur et signalez-la vous-même (exemple plus bas).
  Déclarer la règle `async` marche aussi, mais le champ affiche alors `loading`
  à chaque exécution.
- **Une règle dont la promesse ne se termine jamais retrouve son verdict
  précédent** dès que `submit()` cesse d'attendre (`settleTimeout`). La
  soumission est refusée, mais le champ affiche son ancien verdict jusqu'à
  l'exécution suivante. Pire : si la règle revalide une valeur qui a changé
  pendant l'attente de `submit()`, `submit()` ne cesse pas d'attendre et ne rend
  jamais la main — voir [Réglages](../guides/submit.md#settings).
  Donnez un délai maximal à vos appels réseau — `AbortSignal.timeout(ms)` — pour
  qu'ils se terminent toujours.
:::

## Choisir de tolérer une panne

Une règle qui préfère laisser passer la valeur quand sa vérification est
indisponible attrape la panne et le dit. Elle a alors **conclu**, et la
soumission peut partir :

```ts
import { IValidator, type ValidationReport } from "slz-form";

class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        try {
            const taken = await isTaken(value);
            report.errorIf(taken, "Already taken", { code: "taken" });
        } catch {
            report.warn("Check unavailable", { code: "offline" });
        }
    }
}
```

Le même schéma protège une règle synchrone de l'écart décrit plus haut :

```ts
class HttpsOnly extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            report.error("Not a valid URL", { code: "format" });
            return;
        }
        report.errorIf(url.protocol !== "https:", "Use an https:// address", { code: "https" });
    }
}
```

Le moteur ne choisit pas entre « bloquer » et « laisser passer » : c'est la
règle qui décide, en signalant — ou non.

## Côté behavior : `loading` suit le travail en cours

La même idée vaut pour le flag `loading` d'un behavior. Une passe est
**ouverte** depuis l'appel de son hook jusqu'à ce qu'elle finisse — un hook
synchrone quand il rend la main, un hook asynchrone quand sa promesse se
termine —, et elle ne reste ouverte au-delà que si elle a fini en demandant `loading`
(voir plus bas). Un behavior apporte `loading` à son champ si et seulement si
l'une de ses passes ouvertes l'a demandé — pas parce qu'une écriture a dit
`loading` en dernier. (Le champ est aussi `loading` pendant que son validator
exécute une règle `async`.)

Deux conséquences quand vous écrivez un behavior à la main :

- **une passe qui se termine n'éteint pas le `loading` d'une autre.** `ctx.state`
  est l'ensemble des flags actuels du behavior ; un hook qui renvoie
  `ctx.state.idle()` dit seulement « cette passe-ci a fini » ;
- **ce qui compte, c'est la façon dont la passe finit.** Pour un hook
  synchrone, c'est sa valeur de retour — ou, s'il ne renvoie rien, son dernier
  `ctx.push` ; pour un hook asynchrone, la valeur que résout sa promesse. Un
  `loading` poussé pendant un `await` s'éteint donc quand la promesse se
  termine — sauf si le hook renvoie à nouveau `loading` :

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await prepare();
    sendInBackground(() => ctx.push(ctx.state.idle()));
    return ctx.state.loading();   // still loading until the callback above runs
},
```

Sans cette règle, une réponse tardive qui ne dit rien garderait le champ occupé
pour toujours. Un champ resté `loading` de cette façon est libéré quand le
`settleTimeout` de `submit()` expire, au démontage du champ, ou par `reset()`.
