---
"slz-form": minor
---

Un champ masqué reste dans le payload tant qu'il est monté.

`invisible` ne retire plus un champ de `values` : la visibilité redevient un fait
d'affichage pour le payload. `FormSnapshot.values` (et donc `form.values()`)
itère désormais **tous les champs montés**, masqués inclus — ce qui permet
d'envoyer la valeur par défaut d'un champ conditionnel caché sans avoir à le
rendre visible.

Découplage payload ≠ validité (arbitrage 35) :

- **payload** = tous les champs **montés** (masqués inclus) ;
- **validité et `errors`** = **inchangés**, ils continuent d'exclure les
  masqués — un champ caché, même obligatoire et vide, ne bloque toujours pas la
  soumission.

Pour exclure un champ du payload, il faut désormais le **démonter**, pas
seulement le masquer.
