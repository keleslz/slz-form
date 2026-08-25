---
"slz-form": minor
"slz-react-form": minor
---

La lecture, ce sont deux fonctions et des flags.

`hasFlag(...)` **change de sens** : il était le OU, il devient le **ET**, et
`hasAny(...)` prend le OU. Même nom, même signature, sémantique inversée : rien
ne casse à la compilation, donc **c'est le point à relire en priorité**.
`field.hasFlag("locked", "readonly")` rendait « l'un des deux » et rend
désormais « les deux ». Le renommage `hasEvery` → `hasFlag` disparaît par la
même occasion.

Les booléens dérivés quittent la surface de lecture. `isPristine`, `isValid`,
`isLoading`, `isLocked`, `isReadOnly`, `isVisible`, `showError`, `isBlocking`,
`touched`, `focused`, `required`, `submitting` et `mounted` sont remplacés par
des flags : `hasFlag("pristine")`, `hasFlag("loading")`, `hasFlag("invisible")`
(branche inversée), `hasFlag("touched")`… `showError` devient exactement
`hasFlag("error")`, la conjonction du getter étant morte. Le verdict d'un champ
— indépendant de l'affichage — se lit `errors.length > 0`.

Le formulaire gagne les mêmes deux fonctions et le même vocabulaire : `valid` ·
`error` (le verdict), `idle` · `submitting` · `submitted`, `loading`, `touched`.
`useForm()` perd `isValid` et `isSubmitting`, et un bouton de soumission tient
en un appel : `disabled={!hasFlag("valid", "idle")}`.

Nouveau : un behavior publie **ses propres flags** par `ctx.state.mark(flag)` /
`unmark(flag)`, que la vue lit comme les autres — un skeleton, une vérification
métier en cours. Le moteur transporte le mot sans le connaître. Les mots du
moteur sont refusés sur ce chemin.

Côté bas niveau : `MarkerFlag` rejoint `AvailabilityFlag` — le premier est le
vocabulaire cumulé entier, le second reste ce qu'un behavior a le droit
d'émettre. `UiState.availability` et `BehaviorState.availability` deviennent
`markers`,
`FieldView` expose `hasFlag`/`hasAny` au lieu de `validity`/`blocking`/`visible`,
`FieldSummary` porte l'`UiState` du champ, `ArraySummary` gagne `ui` et `errors`
en perdant `valid`, et `FieldArrayController.isValid` disparaît au profit de
`ui` et `errors`. Nouveaux exports : `BehaviorFlag`, `AnyUiFlag`, `MarkerFlag`,
`BEHAVIOR_FLAGS`, `MARKER_FLAGS`, `RESERVED_FLAGS`, `isReservedFlag`.

Le comportement d'un behavior asynchrone se resserre, et c'est visible :

- **une passe supplantée n'écrit plus rien.** `reset()` supplante tous les
  behaviors du champ ; `recover()` — que la soumission déclenche quand la
  convergence expire — ne supplante que ceux dont il libère une attente, pour
  ne pas rendre muet un voisin qui n'avait rien en vol. Pour une passe
  supplantée, `ctx.push`, `ctx.setValue` et `ctx.setOptions` sont ignorés, et
  son résultat comme son rejet ne tranchent plus : un « Annuler » suivi de la
  valeur qui réapparaît toute seule, c'est fini ;
- **un behavior qui échoue rend son attente, et elle seule.** Ce que l'attente a
  ajouté part, ce qu'elle a retiré reste retiré, et ce qu'il avait posé avant
  survit. S'il n'était jamais entré en attente, sa tranche est intacte. Si une
  autre de ses passes travaille encore, le champ reste `loading` — l'échec de
  l'une ne déclare pas l'autre terminée. Un abandon — `recover()`, quand la
  convergence expire — rend la passe de la même façon qu'un rejet ;
- **un `DebouncedValidator` reste joignable après un remontage.** Son
  abonnement au validator décoré était coupé définitivement au démontage : sous
  `StrictMode`, tout champ devenait sourd aux constats d'un `ExternalValidator`
  différé ;
- **`onUnmount` ne peut plus faire dérailler le démontage**, qu'il lève ou qu'il
  soit écrit `async`.

Deux gardes s'ajoutent au passage, toutes deux visibles d'un consommateur.
`BehaviorState` refuse les mots du moteur — dans `mark`/`unmark` **et** dans son
constructeur, sinon un behavior qui retourne une tranche construite à la main
contournerait la règle. Et `FormController.isBusy` ne compte plus que les champs
montés, comme le flag `loading` du formulaire.

La **façon de lire** change ; ce que la vue rend, non — la démo passe ses 43
assertions sans être touchée. Quelques états publiés bougent malgré tout, et
c'est voulu : `submitting` apparaît comme flag de champ, `focused` cesse de
survivre au démontage, une liste publie `mounted` dès son montage même vide, le
`loading` du formulaire couvre désormais les champs montés-mais-masqués (que la
soumission attend) et non plus les champs démontés (que plus personne
n'attend), et la validité d'une liste se calcule depuis ses constats.
