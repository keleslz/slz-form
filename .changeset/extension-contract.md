---
"slz-form": minor
"slz-react-form": minor
---

Rendre les comportements extensibles par behavior et validator.

Le validator déclare ses dépendances et reçoit une vue en lecture du
formulaire, ce qui rend la validation croisée exprimable — et la revalidation
automatique quand la dépendance change. Les constats portent une gravité et un
code, donc un avertissement peut ne pas bloquer et un message peut être routé
sans que le moteur décide de l'affichage. Les validators se composent, ce qui
permet aux erreurs serveur d'être un validator plutôt qu'une exception au
modèle. `watch` accepte des déclencheurs, pour réagir à l'état d'un voisin et
pas seulement à sa valeur. `readonly` rejoint l'axe disponibilité, et la vue
peut verrouiller ou effacer un champ qu'elle pilote.

`form.array(name)` ajoute les champs répétables : une ligne est un formulaire,
identifiée et jamais indexée, donc la réordonner ne casse aucune dépendance
déclarée. Côté React, `useFieldArray`.

Douze bugs corrigés au passage, dont `reset()` qui vidait au lieu de restaurer,
un formulaire prérempli jugé invalide, un champ invisible obligatoire rendant la
soumission impossible, et un champ figé condamnant toutes les soumissions
suivantes.

Les validators et les behaviors existants compilent et se comportent à
l'identique. **La surface de lecture, elle, change** — voir le changeset
`read-surface-flags`.

La surface bas niveau bouge malgré tout, pour qui l'utilisait directement.
`ValidatorState` porte désormais `issues` à côté de `errors`, et
`FieldHost.notifyFieldChanged` reçoit un jeu de changements au lieu d'un
booléen. `IValidator.handle(value)` reste appelable sans contexte. `UiFlag`
s'élargit à `readonly`, ce qui rend non exhaustif un `switch` consommateur qui
en couvrait toutes les valeurs. `IBehavior.watch` passe de `string[]` à
`WatchTarget[]`, ce qui ne change rien à l'écriture mais compte pour qui le
**lit**.

Enfin, le point d'entrée passe d'un `export *` à une liste explicite : les
rouages internes n'ont pas à devenir un contrat de version. En sortent
`Lifecycle`, `DependencyGraph`, `CompositeValidator`, `createDebouncer`,
`errorsOf`, `sameIssues`, les constantes de flags, `watchedName` et
`watchedTriggers`. Sans conséquence sur npm, puisque rien n'est encore publié.
