---
id: passe-interrompue
title: Une passe interrompue n'est pas un verdict
sidebar_position: 3
description: Ce que publie le moteur quand une règle casse, et pourquoi ce n'est ni « valide » ni l'ancien verdict.
---

# Une passe interrompue n'est pas un verdict

C'est la sémantique qui a le plus régressé au cours du développement, toujours
par le même raccourci : *la passe s'est terminée, donc j'ai un verdict.* Faux
dès qu'une règle casse.

Trois cas, et un seul est correct :

| La passe | Ce qu'on publie |
|---|---|
| complète | le verdict, `valid` ou `error` |
| interrompue, avec un refus | ce refus — il vient d'une règle qui a conclu |
| interrompue, sans refus | **`unverified`, bloquant** |

Un réseau tombé n'est pas un verdict. S'il n'y a aucun refus, le moteur publie
un constat bloquant de `code: "unverified"` : la valeur n'a été jugée par
personne, et la déclarer valide laisserait passer ce que la règle aurait
peut-être refusé.

Deux choses qu'on ne fait **jamais** :

- **garder le dernier verdict connu** — il a été rendu sur une *autre* valeur ;
- **conclure `valid` d'une absence de refus** quand une règle n'a pas pu se
  prononcer.

## Tolérer sa propre panne, en le disant

Une règle qui préfère laisser passer quand sa vérification est indisponible
l'attrape et le dit elle-même. Elle a alors **conclu**, et la soumission passe :

```ts
protected async validate(value: string, report: ValidationReport) {
    try {
        const taken = await isTaken(value);
        report.errorIf(taken, "Déjà pris", { code: "taken" });
    } catch {
        report.warn("Vérification indisponible", { code: "offline" });
    }
}
```

La différence entre les deux comportements n'est pas dans le moteur : elle est
dans le fait que la règle ait, ou non, pris position.

## Côté behavior : l'attente suit le travail en vol

Le pendant, sur l'axe de l'activité. Un champ est `loading` si et seulement si
une passe ouverte de l'un de ses behaviors attend encore — pas parce qu'une
dernière écriture a dit `loading`.

Deux conséquences utiles à connaître quand on écrit un behavior à la main :

- **une passe qui réussit n'éteint pas l'attente d'une autre.** `ctx.state` rend
  la tranche fusionnée du behavior ; un hook qui retourne `ctx.state.idle()` ne
  dit que « moi, j'ai fini » ;
- **l'attente d'une passe dure jusqu'à sa dernière parole.** Un hook synchrone
  parle une dernière fois en poussant, un hook asynchrone en retombant. Une
  attente poussée en cours de route s'éteint donc quand la promesse retombe :

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await préparer();
    envoyerEnTâcheDeFond();
    return ctx.state.loading();   // sinon l'attente retombe avec la promesse
},
```

Sans cette règle, une réponse périmée qui ne dit rien garderait le champ occupé
à vie.
