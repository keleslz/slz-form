---
"slz-form": patch
---

L'activité d'un champ suit le travail réellement en vol.

Elle était la **dernière écriture** d'un behavior ; elle est désormais **dérivée
de ce que ses passes ouvertes veulent** — `loading` si et seulement si l'une
d'elles attend encore. Deux conséquences, visibles d'un consommateur :

- **une passe qui réussit n'éteint plus l'attente d'une sœur.** `ctx.state` rend
  la tranche fusionnée du behavior : un hook qui retournait `ctx.state.idle()`
  déclarait sans le vouloir que *tout* était fini. Il ne dit plus que « moi,
  j'ai fini » ;
- **une passe qui échoue ne défait plus que ce qu'elle avait ajouté.** La
  restitution était l'intersection avec l'état d'entrée de la passe rendue :
  elle effaçait donc ce qu'une sœur **vivante** avait écrit depuis — un
  masquage, un skeleton — et la sœur n'avait aucune raison de le reposer.

La conséquence dépassait l'affichage : un champ que le behavior tenait masqué
rentrait dans le payload, et `submit()` rendait `true` avant que la valeur
attendue soit posée. Les helpers livrés (`lookup`, `loadOptions`) s'en
protégeaient par un jeton de run ; un behavior écrit à la main, non.

Un point de comportement à connaître si vous écrivez vos behaviors à la main :
**l'attente d'une passe dure jusqu'à sa dernière parole.** Un hook synchrone
parle une dernière fois en poussant, un hook asynchrone en retombant — une
attente poussée en cours de route s'éteint donc quand la promesse retombe. Pour
la garder au-delà (le travail continue ailleurs), le hook la redéclare en
sortie :

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await préparer();
    envoyerEnTâcheDeFond();
    return ctx.state.loading(); // sinon l'attente retombe avec la promesse
},
```

Sans cette règle, une réponse périmée qui ne dit rien gardait le champ occupé à
vie.

Deux corollaires, visibles eux aussi :

- **un abonnement externe éteint l'attente qu'il a allumée.** Le rappel qui
  pousse `loading` n'a plus de passe ouverte — la sienne est retombée : c'est
  celle-là qui rouvre, si bien que le même rappel poussant `idle` est reconnu.
  Il fallait auparavant attendre la soumission pour que le champ se libère ;
- **une passe supplantée lâche son attente sans rien rendre.** `reset()` efface
  les tranches et rejoue le montage : ce que la passe périmée croyait avoir
  posé appartient désormais au montage neuf, et le lui retirer en retombant
  emportait un flag qui venait d'être reposé.
