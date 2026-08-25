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

Côté bas niveau : `AvailabilityFlag` est remplacé par `MarkerFlag`,
`UiState.availability` et `BehaviorState.availability` par `markers`,
`FieldView` expose `hasFlag`/`hasAny` au lieu de `validity`/`blocking`/`visible`,
`FieldSummary` porte l'`UiState` du champ, `ArraySummary` gagne `ui` et `errors`
en perdant `valid`, et `FieldArrayController.isValid` disparaît au profit de
`ui` et `errors`.

La **façon de lire** change ; ce que la vue rend, non — la démo passe ses 43
assertions sans être touchée. Quelques états publiés bougent malgré tout, et
c'est voulu : `submitting` apparaît comme flag de champ, `focused` cesse de
survivre au démontage, une liste publie `mounted` dès son montage même vide, le
`loading` du formulaire couvre désormais les champs montés-mais-masqués (que la
soumission attend) et non plus les champs démontés (que plus personne
n'attend), et la validité d'une liste se calcule depuis ses constats.
