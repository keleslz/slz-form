---
"slz-form": minor
---

Un select dépendant vidé par sa dépendance n'affiche plus « requis ».

Quand `loadOptions` rechargeait sa liste parce qu'un champ observé changeait, il
vidait la valeur par `ctx.setValue(undefined)`. Si l'utilisateur avait déjà
choisi une option, le champ était resté `touched` : un select obligatoire
affichait donc « requis » pendant le chargement, et encore après, pour un
effacement que l'utilisateur n'avait pas fait.

Nouvelle méthode sur `BehaviorContext` :

- `ctx.clear()` — vide la valeur **et** rend le champ non touché. Le champ
  repart de zéro : `pristine`, sans erreur affichée.

`loadOptions` l'utilise désormais pour `resetOnReload`. `ctx.setValue(undefined)`
ne change pas de sens.

Seul l'affichage change. Le verdict reste rendu : un champ obligatoire vidé
garde ses `errors`, le formulaire n'est pas `valid`, et `submit()` rallume
l'erreur.
