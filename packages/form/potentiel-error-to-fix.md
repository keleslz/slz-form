# Audit de couverture — `slz-form`

> **Statut : traité.** Ce document était un relevé, pas un changelog. Il reste
> ici comme trace de ce qui a été trouvé et de ce qui a été décidé — les numéros
> de ligne cités décrivent l'état **avant** correction.
>
> Ce qui a été fait, et où le lire :
>
> - Les **douze bugs** de la §2 sont corrigés, chacun avec son test de
>   non-régression dans `test/regressions.test.ts`.
> - Les **cinq trous du contrat d'extension** identifiés en §5 sont comblés :
>   le validator déclare `watch` et reçoit un contexte, les constats portent
>   `severity` et `code`, `watch` accepte des déclencheurs, les validators se
>   composent, et `readonly` a rejoint l'axe disponibilité.
> - Les **champs répétables** (rang 1 de la §4) existent : `form.array(name)`.
>   Sans nommage par chemins — une ligne est un formulaire.
> - Les cas ❌ et 🟡 de la §5 sont rejoués dans `test/parity.test.ts`, écrits
>   avec un behavior ou un validator, **sans capturer le `FormController`**.
> - La **surface de lecture** a suivi : deux fonctions — `hasFlag` (ET) et
>   `hasAny` (OU) — et des flags, au champ comme au formulaire. Plus aucun
>   booléen d'état, et le vocabulaire s'ouvre aux flags de l'application, ce qui
>   règle le dernier reproche de l'audit — un besoin non prévu n'oblige plus à
>   toucher au moteur. Voir `test/flags.test.ts` et `docs/MODEL.md` §2.
>
> Restent hors périmètre, désormais documentés comme tels dans le README :
> les **masques de saisie** (valeur affichée ≠ valeur stockée) et le **rendu
> serveur**.

**Portée** : `packages/form` (moteur) et `packages/react-form` (adapter).
**Méthode** : trois passes indépendantes (une lecture manuelle + deux audits
menés sans se voir), ~70 comportements d'input inventoriés, puis **22
vérifications à l'exécution** rejouées sur le code de la branche. Tout ce qui
est marqué « vérifié » ci-dessous a été observé, pas déduit.

---

## Sommaire

1. [Les trois décisions structurantes](#1-les-trois-décisions-structurantes)
2. [Les 12 bugs confirmés](#2-les-12-bugs-confirmés)
3. [Ce qui est couvert, par lourdeur](#3-ce-qui-est-couvert-par-lourdeur-dimplémentation)
4. [Ce qui n'est pas couvert, par complexité](#4-ce-qui-nest-pas-couvert-par-complexité-dajout)
5. [**Un behavior custom suffirait-il ?**](#5-un-behavior-custom-suffirait-il-) ← le plan
6. [Ordre d'attaque recommandé](#6-ordre-dattaque-recommandé)

---

## 1. Les trois décisions structurantes

Ce ne sont pas des bugs. Ce sont trois choix de conception, chacun défendable
isolément, dont personne n'a écrit les conséquences. Ils expliquent à eux seuls
la majorité des manques.

### ① Le moteur propage des *valeurs*, jamais des *états*

📍 `src/form/FormController.ts:148`

```ts
// Une dépendance se déclenche sur la *valeur* observée, pas sur l'état
// du champ observé. Sans ça, toucher un champ ou le revalider rejouait
// les lookups qui l'observent — au point de relancer un appel réseau
// pendant la soumission.
if (!valueChanged || this.propagating) {
    return;
}
```

L'arbitrage est bon et documenté (`docs/MODEL.md:212`). La conséquence ne l'est
nulle part :

| Ce qui devient impossible | Vérifié |
|---|---|
| Validation croisée (confirmer un mot de passe, date fin > date début) | `pwd` change → `confirm` reste `valid`, `form.isValid === true` avec deux valeurs différentes |
| « Verrouiller B tant que A n'est pas valide » | ne se débloque jamais |
| `lockWhileValidating()`, montré comme objectif dans `.CLAUDE.md` | aucun hook ne se déclenche sur un changement de validité |
| Chaîne **synchrone** A → B → C | `a=1` → `b="b:1"` mais `c === undefined`, en silence |
| Réveil par une valeur initiale (mode édition) | un `hideWhen(["src"])` monté avant `src` reste invisible même si `src` naît avec `initialValue` |

Le piège d'API : `src/field/FieldView.ts:12-20` expose `ui`, `validity` et
`errors` aux observateurs. La surface invite explicitement à un usage que le
moteur ne sert pas.

### ② `pristine` est confondu avec `untouched`

📍 `src/field/FieldController.ts:415-418` et `src/form/FormSnapshot.ts:32-34`

```ts
get isValid(): boolean {
    return this.fields.every((field) => !field.mounted || field.validity === "valid");
}
```

Un champ non touché est `pristine`, donc jamais `valid`. Deux conséquences :

- **Un formulaire entièrement prérempli et correct est `isValid === false`.**
  Le patron « bouton désactivé tant que le formulaire n'est pas valide » ne
  fonctionne pas. La démo affiche « incomplet » en permanence
  (`examples/react/src/page/shared/FormActions.tsx:14-16`).
- **Le snapshot publie `validity: "pristine"` avec `errors: ["email invalide"]`
  non vide.** C'est exactement l'état impossible que le README reproche à
  l'approche `useState`. Le modèle par axes protège le flag, pas le snapshot.

### ③ `invisible` et `locked` ne dispensent pas de la validation

📍 `src/form/FormSnapshot.ts:33` ne regarde que `mounted`, jamais `invisible`.

Un champ conditionnel `required` masqué par `hideWhen` rend le formulaire
**insoumettable de façon invisible** : `submit()` renvoie `false` avec une
erreur sur un champ que l'utilisateur ne voit pas, sans aucun moyen de le
corriger. Le seul contournement natif est de **démonter** le champ — or le
patron de la démo (`return null` **après** `useField`, cf.
`examples/react/src/page/slz/field/TextField.tsx:10-14`) le laisse monté.

> La démo ne le révèle pas parce que son unique champ conditionnel
> (`otherBrand`) n'est pas `required`.

---

## 2. Les 12 bugs confirmés

Tous observés à l'exécution sur le code de la branche. **Tous corrigés depuis**,
chacun couvert par un test dans `test/regressions.test.ts`.

| # | Bug | 📍 | Gravité |
|---|---|---|---|
| B1 | `form.reset()` **vide** les champs au lieu de restaurer `initialValue` — `reset(initialValue?)` accepte un argument que `FormController.reset()` ne lui passe jamais | `field/FieldController.ts:207-217`, `form/FormController.ts:229-234` | ⛔ |
| B2 | Formulaire prérempli et correct → `isValid === false` | `form/FormSnapshot.ts:32-34` | ⛔ |
| B3 | `validity: "pristine"` publié avec `errors` non vide | `field/FieldController.ts:415-418` | ⛔ |
| B4 | Champ `invisible` ou `locked` + `required` → soumission impossible à vie | `form/FormSnapshot.ts:33`, `field/FieldController.ts:191-197` | ⛔ |
| B5 | `loadOptions` n'a pas de jeton de run → une réponse lente et périmée écrase une réponse récente | `util/loadOptions.ts:70-92` | ⛔ |
| B6 | Une requête qui ne répond jamais gèle le champ en `loading+locked` → `isBusy` reste vrai → **toutes** les soumissions ultérieures échouent, sans chemin de récupération | `field/FieldController.ts:149-151` | ⛔ |
| B7 | Aucune revalidation quand une dépendance change | `field/FieldController.ts:252-265` | ⛔ |
| B8 | Chaîne **synchrone** A→B→C rompue en silence par la garde de réentrance | `form/FormController.ts:148,157-165` | ⚠ |
| B9 | Deux `submit()` concurrents partent tous les deux et renvoient `true` | `form/FormController.ts:206` | ⚠ |
| B10 | Un champ démonté accepte encore `change()` et reste dans `form.values()` | `field/FieldController.ts:166-189`, `form/FormController.ts:252-258` | ⚠ |
| B11 | `required: true` sur un booléen `false` → **valid** (`isEmpty(false) === false`) | `validator/IValidator.ts:135-146` | ⚠ |
| B12 | Un échec réseau de `loadOptions` est indiscernable d'une liste vide (`catch → setOptions([])`) | `util/loadOptions.ts:85-89` | ⚠ |

### Bugs relevés lors de la review de PR, non re-vérifiés ici

- Graphe en **losange** (A→B, A→C, B→D, C→D) rejeté comme un cycle.
- `meta` et `disabled` d'une option ne sont **jamais republiés** — `sameOptions`
  ne compare que `value` et `label` (`field/FieldSnapshot.ts:108-114`).
- Un behavior dont la promesse **rejette** laisse le champ `locked`.
- Un démontage **en vol** fige `loading` + `locked`.
- `useField` ne peut pas effacer une valeur pilotée par le parent
  (`field/FieldController.ts:114` : `if (params.value !== undefined)`) et ne
  repousse **jamais** `options` (`react-form/src/useField.ts:90-92`).
- `validateNow()` fait un `flush()` **avant** de revalider.

### Écarts documentation / code

| Affirmation | Réalité |
|---|---|
| `.CLAUDE.md` et `docs/MODEL.md` : « Validator composable (N validators sur un field) » | `FieldParams.validator` est **unique** (`field/FieldController.ts:21`) |
| `form/FormController.ts:266` : « couvre les lookups en chaîne » | vrai en async, **faux en sync** |
| `README.md` : reproche à `useState` que « les états impossibles sont représentables » | le snapshot publie `pristine` + `errors` non vide |
| `docs/MODEL.md:124` : « une instance de behavior peut être partagée entre deux champs » | vrai — mais rien ne dit qu'un **`IValidator` ne peut pas l'être** : son état vit sur l'instance (`validator/IValidator.ts:53-57`), donc le partager couple silencieusement deux champs |
| `README.md` montre `disabled={field.isLocked}` comme la façon de piloter l'UI | aucune API ne permet de verrouiller un champ **depuis la vue** : `FieldUpdate` = `required \| value \| options` |

### Piège de sous-classement

`Behavior` déclare `watch` comme **champ de classe** (`behavior/Behavior.ts:11`) :

```ts
export abstract class Behavior<T = string, M = never> implements IBehavior<T, M> {
    readonly watch: readonly string[] = [];
}
```

Une sous-classe qui écrit `override get watch() { … }` est **silencieusement
masquée** par ce champ : le behavior ne reçoit jamais `onDependencyChanged`, sans
la moindre erreur. Seul `override readonly watch = [...]` fonctionne.

---

## 3. Ce qui est couvert, par lourdeur d'implémentation

Du plus coûteux au plus trivial. Les trois passes convergent sur cet ordre.

| Rang | Mécanisme | 📍 | Ce qu'il résout |
|---|---|---|---|
| 1 | **Convergence async à la soumission** (~105 l.) | `form/FormController.ts:206-311` | `submit()` → `settle()` → `waitIdle()` : boucle de passes bornée (`MAX_SETTLE_ROUNDS = 5`), deadline (`settleTimeout`), souscriptions temporaires. Trois sources de « en vol » réconciliées : debounce, behavior, validator. La pièce la plus chère, et la plus rare — la plupart des libs ignorent ce problème |
| 2 | **Modèle d'état à trois axes** | `state/UiFlag.ts`, `BehaviorState.ts`, `UiState.ts`, fusion en `field/FieldController.ts:399-404` | Validité (exclusive, Validator seul), activité (exclusive), disponibilité (cumulative). Rend les états contradictoires inexprimables — sur les flags |
| 3 | **Réactivité inter-champs déclarée et vérifiée** | `form/DependencyGraph.ts`, `field/FieldController.ts:91-93,358-365` | `watch` déclaratif, détection de cycle par DFS avec rollback, throw sur lecture non déclarée |
| 4 | **Anti-race de la validation** | `validator/IValidator.ts:82,96-98`, `util/debounce.ts:31-33` | Jeton de run monotone ; le debouncer **résout** les fenêtres remplacées au lieu de les abandonner — le détail qui évite une promesse pendue |
| 5 | **`loadOptions`** (113 l.) | `util/loadOptions.ts` | 3 déclencheurs combinables, debounce par champ, `resetOnReload`, flush au submit, cancel au démontage |
| 6 | **`lookup`** (112 l.) | `util/lookup.ts:80,90` | Même armature + garde anti-écrasement de la saisie en cours |
| 7 | **Stabilité référentielle des snapshots** | `field/FieldSnapshot.ts:88-114` | Ce qui rend `useSyncExternalStore` correct sans sélecteur : un champ qui change ne re-rend pas les autres |
| 8 | **Cycle de vie et annulation** | `lifecycle/Lifecycle.ts`, `field/FieldController.ts:100,125` | 3 états, `AbortController` renouvelé au montage, garde après chaque `await` |
| 9 | **Typage dérivé de la map** | `util/behaviorsFor.ts`, `field/Field.ts` | `ValueOf`/`MetaOf`/`OptionValue`, `meta` inféré du callback API. Coût nul à l'exécution |
| 10 | **`prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `suggest`** | `util/` | 10 à 26 l. chacun — recompositions des mécanismes ci-dessus |
| 11 | **Socle** | — | `required` + `isEmpty`, `touched`/`focused`/`showError`, options statiques, `FormRegister` |

---

## 4. Ce qui n'est pas couvert, par complexité d'ajout

| Rang | Manque | Effort | Ce qui bouge |
|---|---|---|---|
| 1 | **Champs répétables + valeurs imbriquées** (`items[3].qty`, `address.street`) | XL | `FieldsShape` plat → arbre (`field/Field.ts:23`), `FieldNameOf`, `DependencyGraph` par motif, `values()`, `useFieldArray`. Seul point qui remet en cause une hypothèse structurante |
| 2 | **Validation croisée** | L | Signature `validate(value, report)` (`validator/IValidator.ts:63`, changement cassant) + dépendances **de validation** + revalidation sur dépendance. Dépend du rang 4 |
| 3 | **SSR / hydratation** | L | `getServerSnapshot` absent (`react-form/src/useField.ts:83`) n'est que la façade : il faut décider ce que font `onMount`/`prefill` sans réseau |
| 4 | **Propagation d'état (et non de valeur seule)** | M | `form/FormController.ts:141-166` + un anti-boucle plus fin que le booléen `propagating`. **Débloque à lui seul le rang 2 et « réagir à la validité du voisin »** |
| 5 | **Multi-étapes / validation partielle** | M | `submit(scope)`, `isValid(scope)`, groupes dans `FieldParams` |
| 6 | **Erreurs serveur injectées par champ** | M | Casse « le validator est seule autorité » : emplacement d'erreurs externes dans `buildSnapshot`, effacé au prochain `change` |
| 7 | **Masque / `parse`+`format`** (valeur affichée ≠ stockée) | S/M | Deux callbacks sur `FieldParams`, appliqués dans `change` (`field/FieldController.ts:166`). Le curseur reste à la charge de la vue |
| 8 | **Focus programmatique / scroll sur la 1ʳᵉ erreur** | M | `focus()` (`field/FieldController.ts:171`) est une notification **entrante**, jamais une commande sortante. Registre de refs dans l'adapter |
| 9 | **Avertissements + canal d'erreur non-validante** | S/M | Le modèle par axes est fait pour ça, mais toucher `UiState` touche tous les consommateurs |
| 10 | **Composition de N validators** | S | `CompositeValidator extends IValidator`, ~20 l., **zéro changement du cœur** |
| 11 | **Mode de validation onChange/onBlur/onSubmit** | S | Une option + `resolveValidity` + `showError` |
| 12 | **Accessibilité (`id`, `aria-*`)** | S | Purement dans l'adapter (`react-form/src/useField.ts:99-122`) |
| 13 | **`setValues` en masse / autosave / brouillon** | S | Boucle sur `this.fields` + `listen`/`values` |
| 14 | **Pagination d'options, `optgroup`, `creatable`** | S | `appendOptions` à côté de `setOptions` ; `group?: string` dans `FieldOption` |
| 15 | **`readonly` ≠ `disabled`** | XS | Ajouter `"readonly"` à `AvailabilityFlag` (`state/UiFlag.ts:16`) — l'axe est déjà cumulatif, `merge` ne change pas |
| 16 | **`dirty`, effacer une valeur pilotée, i18n du message par défaut, `submitCount`** | XS | 1 à 4 lignes chacun |

---

## 5. Un behavior custom suffirait-il ?

**La question posée :** en écrivant un `IBehavior` sur mesure, sans toucher au
cœur, est-ce qu'on règle le problème ?

### Ce qu'un behavior peut, et ne peut pas

📍 `behavior/BehaviorContext.ts`, `behavior/IBehavior.ts`, `state/BehaviorState.ts`

| ✅ Il peut | ❌ Il ne peut pas |
|---|---|
| écrire **sa** valeur (`ctx.setValue`) | écrire dans un autre champ |
| publier **ses** options (`ctx.setOptions`) | émettre sur l'axe **validité** — `BehaviorState.ts:11-12` l'interdit explicitement |
| émettre `loading`, `locked`, `invisible` | émettre `required` ou `readonly` — ces axes n'existent pas |
| lire tout le formulaire (`ctx.form`, lecture seule) | s'abonner au formulaire (`FormView` n'a **pas** de `subscribe`, volontairement) |
| publier un état intermédiaire pendant un `await` (`ctx.push`) | créer ou détruire un champ |
| réagir à : mount, sa propre saisie, focus/blur, submit, **changement de valeur** d'un champ observé | réagir au changement d'**état** d'un champ observé |
| garder un état interne indexé par `ctx.name` (patron déjà utilisé par `loadOptions`) | toucher le DOM |

### La porte de sortie

📍 `form/FormController.ts:117`

```ts
get(name: FieldNameOf<TFields>): AnyField | null   // AnyField = FieldController<any, any>
```

`form.get()` rend le **contrôleur complet**, pas une vue en lecture. Un behavior
écrit dans le module du formulaire peut donc capturer l'instance par closure et
appeler `validateNow()`, `update({ required })`, `listen()`, `reset(v)`.

C'est ce qui rend une bonne moitié des manques contournables — au prix de sortir
du contrat que le moteur affiche.

### Verdict, cas par cas

Légende : ✅ un behavior custom suffit · 🟡 il suffit mais en trichant ·
❌ il ne suffit pas, il faut toucher le cœur

| Cas | Verdict | Détail — *toutes les solutions ✅/🟡 ont été exécutées et vérifiées* |
|---|---|---|
| **B8 — chaîne synchrone A→B→C** | ✅ | **Différer l'écriture d'une microtâche suffit.** Mesuré : `sync → c=undefined` ; `micro`, `macro`, `async` → `c="c:b:1"`. Une ligne : `void Promise.resolve().then(() => ctx.setValue(v))` |
| **B6 — champ gelé par une requête sans réponse** | ✅ | Le behavior pose son propre timeout : `await Promise.race([appel, delai(5000)])` puis `return ctx.state.idle().unlock()`. Vérifié : `submit()` repasse à `true`, `isBusy` à `false` |
| **B5 — `loadOptions` hors séquence** | ✅ | Réécrire un `loadOptions` maison avec un compteur de run, en recopiant le patron de `validator/IValidator.ts:82,96-98` |
| **Pagination / scroll infini / `creatable`** | ✅ | Le behavior accumule sa liste dans une `Map` indexée par `ctx.name` et rappelle `ctx.setOptions(tout)`. `loadOptions` fait déjà ça pour ses debouncers |
| **`optgroup`** | ✅ | Passer le groupe dans `meta` et le rendre côté vue. Aucun changement de type nécessaire |
| **Retry, cache, dédoublonnage d'appels** | ✅ | Entièrement dans le callback `fetch` |
| **Normalisation au blur** (trim, majuscules) | ✅ | `onBlur` + `ctx.setValue`. Déjà possible, simplement pas outillé |
| **Réveil par une valeur initiale** (mode édition) | ✅ | Ajouter un `onMount` qui évalue le prédicat sur `ctx.form`. `hideWhen` le fait déjà (`util/hideWhen.ts:16`) — le trou est l'**ordre de montage**, pas le hook |
| **B7 + validation croisée** | 🟡 | **Vérifié : ça marche.** Un behavior `watch: ["pwd"]` sur `confirm` dont `onDependencyChanged` appelle `form.get("confirm").validateNow()`, plus un validator qui lit `form.get("pwd")` par closure → `confirm` passe bien à `error`. Mais on viole deux invariants affichés (le validator ne connaît pas le form ; la validité a une source unique) et on écrit le nom du champ en dur |
| **Réagir à l'état d'un voisin** | 🟡 | **Vérifié : ça marche.** `onMount` s'abonne directement : `form.get("src").listen(() => ctx.push(…))`. Mais ça court-circuite le `watch` déclaratif, échappe à la détection de cycle, et **fuit l'abonnement** si on oublie de le couper dans `onUnmount` |
| **B4 — `invisible` + `required` bloque le submit** | 🟡 | **Vérifié : ça marche.** Le behavior retire `required` en même temps qu'il masque : `form.get("y").update({ required: !hidden })` → `submit()` repasse à `true`. Mais la règle métier se retrouve écrite à deux endroits |
| **Masque / formatage à la frappe** | 🟡 | `onChange` + `ctx.setValue(format(v))` fonctionne (profondeur de réentrance 2, formateur devant être idempotent). Le curseur reste à la charge de la vue, et rien n'est documenté ni testé |
| **`required` conditionnel** | 🟡 | Pas d'axe `required` dans `BehaviorState` → il faut passer par `form.get(name).update({ required })` |
| **Erreurs serveur par champ** | 🟡 | Validator mutable + `validateNow()`. Vérifié comme faisable — mais l'erreur **survit à la frappe suivante**, faute de canal d'invalidation |
| **B1 — `reset` perd `initialValue`** | 🟡 | En userland : ne pas appeler `form.reset()`, appeler `field.reset(valeurInitiale)` soi-même. Un behavior ne peut pas : `reset` est sur le contrôleur |
| **B10 — champ démonté dans `values()`** | 🟡 | Filtrer soi-même : `names().filter(n => get(n).snapshot.mounted)` |
| **B11 — `required` sur booléen** | ✅ | Un validator dédié. La démo le fait déjà (`ConsentValidator`) |
| **N validators composés** | ✅ | `CompositeValidator extends IValidator`, ~20 l., aucun changement du cœur. **C'est le manque le plus facile de toute la liste, et il est annoncé comme un fondamental** |
| **Multi-étapes** | 🟡 | Calculer la validité par étape soi-même sur une liste de noms. Mais `submit()` touche et valide **tout** — pas contournable |
| **B2 — `isValid` sur formulaire prérempli** | ❌ | Dérivé de `resolveValidity` (`field/FieldController.ts:415-418`). Un behavior n'a aucune prise sur l'axe validité. Contournement userland seulement : ignorer `isValid` et regarder si `form.snapshot.errors` est vide |
| **B3 — `pristine` + `errors` non vide** | ❌ | Même cause. C'est le snapshot publié qui est incohérent |
| **B12 — échec réseau indiscernable d'une liste vide** | ❌ | Il n'existe aucun canal d'erreur **non validante**. Le behavior ne peut ni émettre `error`, ni transporter un message |
| **Avertissements non bloquants** | ❌ | L'axe validité est un ternaire fermé (`state/UiFlag.ts:10`). Rien à détourner |
| **`readonly` ≠ `disabled`** | ❌ | `AvailabilityFlag` est une union fermée : impossible d'ajouter une valeur depuis l'extérieur |
| **B9 — double submit** | ❌ | `submit()` est sur le form. Un booléen côté appelant, à défaut |
| **Champs répétables / valeurs imbriquées** | ❌ | Un behavior ne peut pas créer de champ, et `FieldNameOf` interdit les noms dynamiques à la compilation |
| **SSR** | ❌ | `useSyncExternalStore` sans `getServerSnapshot`, dans l'adapter |
| **Focus programmatique, `aria-*`** | ❌ | Le cœur est agnostique du DOM par construction. À faire dans l'adapter, sans rapport avec les behaviors |

### Ce que ça donne en agrégé

| | Nombre |
|---|---|
| ✅ Réglé par un behavior (ou un validator) custom, proprement | **9** |
| 🟡 Réglé en trichant — en capturant le `FormController` par closure | **8** |
| ❌ Impossible sans toucher au cœur | **10** |

### La réponse en une phrase

**Un behavior custom règle tout ce qui touche à la valeur, aux options et à
l'asynchrone — et rien de ce qui touche à la validité.**

La frontière est nette et tient à une seule ligne :
`state/BehaviorState.ts:11-12`, « *A Behavior never carries the validity axis —
that belongs to the Validator* ». Tout ce qui est ❌ ci-dessus est, sans
exception, une histoire de validité, de structure de champs, ou de DOM.

Les 🟡 méritent une décision plutôt qu'un contournement : ils marchent tous, mais
en capturant le `FormController` par closure, c'est-à-dire en contredisant les
invariants que le projet met en avant. Les laisser être la réponse officielle
reviendrait à dire que les invariants ne tiennent que tant qu'on ne s'en sert
pas.

---

## 6. Ordre d'attaque recommandé

Par ratio valeur / coût. Rien n'est engagé — c'est une proposition.

### Lot 1 — trivial, gros effet (≈ 1 h)

| | Correctif | 📍 |
|---|---|---|
| B1 | Mémoriser `initialValue` dans le constructeur, l'utiliser par défaut dans `reset()` | `field/FieldController.ts:71,207` |
| B9 | Garde en tête de `submit()` | `form/FormController.ts:206` |
| B10 | `if (!this.lifecycle.isMounted) return` dans `change`/`focus`/`blur` | `field/FieldController.ts:166-189` |
| B11 | Option `requiredTrue` dans `ValidationOptions` (ne **pas** toucher `isEmpty` : `false` peut être une valeur légitime) | `validator/IValidator.ts:135-146` |
| — | `dirty`, découle de B1 | `field/FieldSnapshot.ts` |
| — | `CompositeValidator` — le fondamental annoncé et manquant | nouveau fichier |

### Lot 2 — cohérence de la validité (≈ ½ journée)

| | Correctif | Décision à trancher |
|---|---|---|
| B2 + B3 | Séparer « pas encore touché » de « pas encore valide » | Faut-il un `isSubmittable` distinct d'`isValid` ? |
| B4 | Exclure les champs `invisible` de la validité et du payload | `invisible` doit-il valoir « absent » ? **À écrire dans `docs/MODEL.md` avant de coder** |

### Lot 3 — fiabilité de l'async (≈ ½ journée)

| | Correctif | 📍 |
|---|---|---|
| B5 | Jeton de run dans `loadOptions`, en recopiant le patron du validator | `util/loadOptions.ts:70-92` |
| B6 | Deadline de récupération sur `isBusy`, pour qu'un champ gelé ne condamne pas le formulaire | `field/FieldController.ts:149-151` |
| B12 | Canal d'erreur non validante (4ᵉ axe ou champ `issues`) | `state/UiState.ts` |

### Lot 4 — le vrai chantier (≈ 1 semaine)

**Propagation d'état**, `form/FormController.ts:141-166`. Remplacer la garde
booléenne par une file de propagation qui distingue les axes propagés. Débloque
d'un coup : B7, B8, la validation croisée et la réaction à l'état d'un voisin.

> À faire **avant** publication : une fois `validate(value, report)` publié,
> l'élargir sera un changement cassant.

### Hors lots

Champs répétables, SSR, multi-étapes, masques : ce sont des fonctionnalités, pas
des correctifs. À arbitrer selon ce que la lib veut être — le README dit déjà
clairement ce qu'elle **n'est pas**, cette liste mérite d'y être précisée.
