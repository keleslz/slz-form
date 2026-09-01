---
"slz-form": minor
---

Le moteur ne loggue plus jamais : il route ses erreurs vers le formulaire.

Nouvelle surface publique sur `FormController`, **hors du snapshot** :

- `form.onEngineError(listener): () => void` — s'abonner aux erreurs du moteur ;
- `form.engineErrors: readonly EngineError[]` — les erreurs captées, bornées aux
  50 plus récentes, vidées par `reset()` (pas par la soumission).

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
