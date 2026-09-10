---
"slz-form": minor
---

Le moteur ne loggue plus jamais : il route ses erreurs vers le formulaire.

Nouvelle surface publique sur `FormController`, **hors du snapshot** :

- `form.engineErrors: readonly EngineError[]` — les erreurs captées, bornées aux
  50 plus récentes, vidées par `reset()` (pas par la soumission).

Une surface **pull** : un accesseur qu'on lit quand on a une raison (après un
`submit()` refusé, dans un panneau de debug, dans un test), pas un abonnement.
Une erreur du moteur est un crash déjà rattrapé — un enregistrement de
diagnostic, pas un événement à traiter en temps réel.

Le type `EngineError` et la classe `EngineGuardError` sont exportés.

Ce qui change :

- **plus aucun `console.*` dans le moteur.** Un hook asynchrone qui rejette, une
  garde du moteur violée (flag réservé, `watch` non déclaré) ou une règle de
  validation qui casse est désormais **routée** vers le formulaire au lieu d'être
  écrite dans la console ;
- chaque erreur est taguée `hook-error` (le code consommateur a levé) ou
  `guard-violation` (le moteur a levé), via une `EngineGuardError` typée que les
  gardes lèvent, classée par `instanceof` au site du catch ;
- la validation route par un sink injecté au site du catch
  (`ValidationContext.reportFailure`), propagé base → composite → différé, sans
  toucher `publish`, `ValidatorState` ni `equals` ;
- un validator appelé **hors** d'un formulaire (contexte détaché) n'a nulle part
  où router et se tait — angle mort assumé.
