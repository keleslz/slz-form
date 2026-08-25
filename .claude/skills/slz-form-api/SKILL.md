---
name: slz-form-api
description: Règles de conception de l'API publique de slz-form. À charger avant toute modification de packages/form ou packages/react-form — ajout ou changement d'un behavior, d'un validator, d'un flag, d'un hook, d'une signature exportée — et avant de répondre à « comment fait-on X avec slz-form ? ». Contient les hard rules non négociables sur la simplicité de l'API, l'extensibilité par behavior et validator, et la séparation stricte entre le moteur agnostique et l'UI.
---

# Concevoir l'API de slz-form

## Hard rules

Elles ne se négocient pas. Une proposition qui en viole une est à réécrire, pas
à justifier.

### 1. L'API publique reste simple

- **Un objet de configuration par behavior.** Jamais de paramètres positionnels
  multiples, jamais de sous-objets imbriqués au-delà d'un niveau.
- Le nom du champ, ce qu'il observe, ce qu'il valide, comment il réagit : ça
  tient dans un objet plat et lisible.
- Une option nouvelle doit avoir un **défaut qui rend son absence invisible**.
- Devant le choix entre une option de plus sur un helper existant et un helper
  dédié au cas réel, prendre le helper dédié : `lockUntilValid({ watch })` bat
  `lockWhile({ watch, on, when })`.

### 2. Tout comportement s'exprime par un behavior et/ou un validator

C'est la raison d'être de la lib. Si un besoin exige de modifier le cœur, alors
**c'est le contrat d'extension qui est en défaut** — pas un cas particulier à
câbler en dur.

Devant un besoin non couvert, la question n'est jamais « où ajouter ce cas ? »
mais « quel trou du contrat d'extension l'empêche ? ».

### 3. On n'ajoute jamais un accesseur dérivé d'un flag

Pas de `isVisible`, pas de `isLoading`, pas de `showError`. La surface de lecture
d'un champ comme d'un formulaire, ce sont **`hasFlag` / `hasAny`, les données et
les actions** — rien d'autre (invariant 32).

Un besoin de `isX` ne signale jamais un accesseur manquant : il signale **un flag
manquant, ou un mot mal choisi**. C'est l'erreur de `189b8de`, qui a livré l'API
par flags *et* ses sept booléens dans le même diff — l'échappatoire est devenue
la norme, et l'API par flags est morte à l'usage.

### 4. Tout est composite

Plusieurs behaviors et plusieurs validators par champ, chacun gardant sa tranche
d'état ou ses règles. Aucune API ne doit supposer qu'il n'y en a qu'un.

### 5. Parité avec React nu

**Rien de ce qui est faisable avec `useState` et un `useEffect` ne doit être
impossible avec la lib.** C'est le critère d'acceptation, et il se vérifie :
`packages/form/test/parity.test.ts` reprend chaque cas et le réécrit avec un
behavior ou un validator.

Contrainte de ce fichier de test, qui est le cœur de la règle : **aucun cas ne
capture le `FormController` par closure.** Tout passe par `ctx`. Un cas qui
n'y arrive qu'en capturant le formulaire n'est pas couvert — il est contourné,
et le contournement contredit les invariants affichés par le projet.

### 6. Aucune UI/UX dans le moteur

- Le moteur transporte `code` et `severity`. Il ne décide **jamais** où ni
  comment afficher : snackbar, sous le champ, ou nulle part, c'est la vue.
- Il ne connaît ni skeleton, ni spinner, ni couleur, ni libellé.
- `packages/form/src` : **aucun import non relatif**. Pas de DOM, pas de
  framework. Les seuls globaux sont ceux que tout hôte JavaScript fournit :
  `setTimeout`/`clearTimeout`, `AbortController`, `Date.now`, et
  `console.error` pour signaler une erreur du moteur qu'on ne peut pas
  propager.
- Un adapter (`packages/react-form`) est un pont, pas un endroit où mettre des
  règles.

### 7. Zéro `as` dans le code consommateur

Le narrowing tient de bout en bout : nom de champ contraint à la map, valeur
inférée, `meta` inféré depuis le callback API.

Le typage n'est relâché qu'aux **ponts génériques**, tous documentés sur place,
et pour la même raison : le helper lié au formulaire a déjà vérifié ce que la
fonction générique ne voit plus.

- `packages/react-form/src/useField.ts` et `useFieldArray.ts` — `hooksFor` a
  contraint le nom, la fonction sous-jacente ne voit plus la map.
- `packages/form/src/util/behaviorsFor.ts` — même pont, côté behaviors : la
  fonction générique a déjà vérifié le nom et le type, le behavior produit ne
  les voit plus.
- `packages/form/src/form/FormController.ts` — `field()` et `array()` font le
  pont entre la map typée et les contrôleurs génériques.
- `packages/form/src/field/FieldController.ts` et `validator/IValidator.ts` —
  la valeur est passée à `validate` après que la classe de base a vérifié
  qu'elle n'est pas vide.
- `packages/form/src/state/UiState.ts` et `state/BehaviorState.ts` — `AnyUiFlag`
  est `UiFlag | (string & {})` : les flags du moteur restent proposés à
  l'autocomplétion, et ceux de l'application passent. Ce n'est pas un `as`, mais
  c'est le même genre de relâchement, et il est ici pour la même raison.

**Cette liste est limitative.** Un `as` ailleurs est un défaut de conception des
types, pas une commodité — et jamais dans le code consommateur. Quand on en
ajoute un, on l'ajoute ici, avec sa raison.

### 8. Lire `docs/MODEL.md` avant, le mettre à jour après

Avant d'implémenter : lire les invariants et les arbitrages, pour savoir lequel
on s'apprête à toucher.
Après : consigner ce qui a changé — un arbitrage nouveau va dans §5, un
invariant nouveau **en fin** de la table du §6.

### 9. Ne jamais renuméroter les invariants

Le code les référence par numéro (`FieldController.ts:35` — « invariants 2, 5,
6 »). On **ajoute** à la fin. On ne réordonne pas, on n'insère pas.

---

## Le modèle, en bref

### Les flags, et les deux fonctions

| Flag | Nature | Qui l'émet |
|---|---|---|
| `pristine` · `valid` · `error` | **s'excluent** | le Validator, **seul** |
| `idle` · `loading` | **s'excluent** | Behaviors + Validator |
| `locked` · `readonly` · `invisible` | s'additionnent | Behaviors + Controller + vue |
| `required` · `touched` · `focused` · `mounted` · `submitting` | s'additionnent | le Controller |
| *ceux de l'application* | s'additionnent | Behaviors — `mark` / `unmark` |

Au formulaire, les mêmes mots : `valid` · `error` (exclusifs — c'est le verdict),
`idle` · `submitting` · `submitted` (exclusifs), `loading` et `touched`.

La lecture, ce sont **deux fonctions** : `hasFlag(...)` est le **ET**,
`hasAny(...)` le **OU**. Elles sont identiques au champ et au formulaire.

Une union plate produirait `pristine` + `error`, qui n'est pas un état. D'où les
deux natures, et le sens précis du retrait d'un flag : on remplace dans un groupe
exclusif, on cesse d'émettre ailleurs — l'absence vaut défaut.

**Cumulé ouvert, exclusif fermé.** Ajouter une valeur à un groupe exclusif est
légitime (c'est ainsi que `readonly` est arrivé) ; **l'ouvrir à des flags libres
ne l'est pas**, ça recrée le `Set` plat que le modèle existe pour écarter. Côté
cumulé au contraire, deux behaviors s'additionnent sans pouvoir se contredire :
l'application y déclare ses propres flags, et c'est ce qui rend exprimables les
besoins qu'on n'a pas prévus.

### Qui fait quoi

- **Behavior** — *réagit*. Écrit sa valeur, publie ses options, émet activité et
  disponibilité. Ne décide **jamais** de la validité.
- **Validator** — *juge*. Seule autorité sur la validité. Déclare `watch` pour
  lire d'autres champs, produit des constats portant `severity` et `code`.

Le partage des rôles tient parce que le juge a des **yeux**
(`ValidationContext` : `watch` déclaré, lecture seule) et une **sonnette** —
`IValidator.requestRevalidation()`, `protected`, qu'un validator déclenche
quand son verdict peut changer sans que la valeur bouge (`ExternalValidator`).
Un changement de dépendance déclarée le rejoue aussi, automatiquement.

Ne pas donner l'axe validité aux behaviors pour « simplifier » : c'est ce qui
rend les flags dignes de confiance.

### Une passe interrompue n'est pas un verdict

C'est la sémantique qui a le plus régressé au cours du développement, à chaque
fois par le même raccourci : *la passe s'est terminée, donc j'ai un verdict.*
Faux dès qu'une règle casse.

Trois cas, et un seul est correct :

| La passe | Ce qu'on publie |
|---|---|
| complète | le verdict, `valid` ou `error` |
| interrompue, avec un refus | ce refus — il vient d'une règle qui a conclu |
| interrompue, sans refus | **`unverified`, bloquant** — surtout pas `valid`, surtout pas le verdict précédent |

Ne jamais « garder le dernier verdict connu » : il a été rendu sur une **autre
valeur**. Ne jamais conclure `valid` d'une absence de refus quand une règle n'a
pas pu se prononcer.

Toute modification de `IValidator.publish`, de `CompositeValidator.validate` ou
de `DebouncedValidator.validate` commence par un test dans `review-9.test.ts`,
qui couvre les quatre écritures — règle nue, composée, différée, différée et
composée. Elles doivent se comporter **identiquement** : c'est là que les
divergences se sont logées à répétition.

### L'affichage n'est pas le verdict

- Au **champ**, `error` est ce qu'on **affiche** : éteint tant que le champ n'a
  pas été touché, pour qu'un prefill n'allume pas d'erreur.
- Au **formulaire**, `error` est ce qui est **vrai** : un formulaire prérempli et
  faux ne part pas, même si aucun champ ne s'allume.
- Le verdict d'un champ pris isolément, c'est **`errors` non vide**. Il n'a
  volontairement pas de flag : `error` et un `blocking` voisin se confondaient à
  l'usage, et le verdict est déjà porté par une donnée que la vue lit de toute
  façon.

Ne pas les confondre, et ne pas « corriger » l'un en cassant l'autre : c'est
l'arbitrage 24, et il tient par cette répartition sur deux niveaux.

### Une ligne est un formulaire

Les champs répétables n'ont pas de nommage par chemins. Une ligne est un
`FormController`, identifiée et jamais indexée. Retirer ou déplacer une ligne ne
renomme rien, donc aucun `watch` ne se met à pointer dans le vide.

---

## Réflexes

**Avant d'ajouter quoi que ce soit au cœur**, se demander : est-ce que ça
s'écrit avec un behavior ou un validator ? Si oui, ça n'a rien à faire dans le
moteur. Si non, quel trou du contrat l'empêche ?

**Un nouveau cas d'usage** commence par un test dans `parity.test.ts`, écrit
sans capturer le `FormController`. S'il ne passe pas, le manque est identifié
avant d'avoir écrit une ligne de moteur.

**Une correction de bug** commence par un test dans `regressions.test.ts`.

**Vérifier, toujours dans cet ordre :**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

puis le bout en bout, qui doit rester vert **sans modifier la démo** — c'est la
preuve qu'un changement est non cassant :

```bash
cd examples/react && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173 npm run test:e2e -w examples/react
```

### Rendre l'attente d'un behavior

Six tours de revue d'affilée y ont trouvé un bloquant, toujours le même
symptôme : un champ obligatoire reste masqué après un échec, sort du payload, et
le formulaire part vide en se croyant valide.

La règle tient en une phrase : **on rend ce que la passe a ajouté, et rien
d'autre** — l'intersection entre la tranche courante et l'état d'entrée de la
passe. Ce qu'elle a retiré reste retiré ; ce qui était là avant elle survit.

Ce qui a échoué, et pourquoi, pour ne pas y revenir :

| Tentative | Ce qu'elle casse |
|---|---|
| remettre `BehaviorState.neutral` | efface un fait posé au montage, que `onMount` ne rejouera pas |
| restaurer l'état d'entrée tel quel | ressuscite un flag que le behavior venait de retirer |
| indexer la référence sur le passage à `loading` | rate tout behavior qui pousse un état sans `loading` |
| une référence partagée par behavior | deux auteurs et deux comptabilités qui se contredisent |
| fermer une passe en regardant l'activité du **behavior** | `run` en dispatche une par behavior : chaque `focus` ou `blur` pendant un appel en laisse une ouverte, et `recover()` rend contre elle |
| n'ouvrir de passe que depuis un hook | un `ctx.push` d'abonnement allume `loading` hors de tout hook : sans référence, `recover()` ne rend rien |
| déduire « une sœur travaille » du **nombre** de passes ouvertes | une passe ouverte n'est pas une passe en vol : `release` publiait un `loading` que personne n'éteindrait, et le champ restait occupé à vie |
| deviner l'écrivain (« la dernière passe ouverte ») | faux dès qu'une passe sœur s'ouvre après celle qui écrit — un `blur` suffit : le voisin devient titulaire, et le vrai travailleur ne l'est pas |
| distinguer « fait durable » et « décoration » par la position d'un `await` | indécidable : deux passes au flux identique, `verified`+`locked` d'un côté, `skeleton`+`invisible` de l'autre, exigeraient des issues opposées |
| lire une transition d'activité, ou un nombre de passes, pour savoir qui tient l'attente | la passe le dit — chaque relecture par un proxy a coûté un tour de revue |
| un seul booléen pour « qui tient la référence » et « quelqu'un travaille » | les deux questions n'ont pas la même arité : une réponse pour la première, plusieurs pour la seconde. Un écho synchrone de `loading` passait pour un travailleur, une passe discrète gardait le champ occupé |
| ne rendre qu'une passe quand `recover()` les abandonne toutes | ce qu'une autre avait posé restait — champ masqué à vie, hors payload, formulaire déclaré valide |
| oublier `inFlight` sur **un** des trois créateurs d'attente détachée | le rejet d'une sœur éteint une attente que personne n'a rendue, et le verrou posé avec elle sort du champ d'action de `recover()`, qui ne visite que les tranches encore `loading` |
| laisser une passe retomber sans reprendre son attente | l'attente devient orpheline, et `recover()` n'a plus rien à quoi la comparer |

La référence appartient donc à la **passe** (`Pass { before, generation, … }`),
ouverte avant l'appel du hook et fermée dès qu'elle retombe — ou tout de suite
si elle n'a ouvert aucune attente. Deux corollaires, chacun payé d'un tour de
revue : une passe ne reste ouverte que si **elle-même** a allumé `loading`, et
une attente allumée hors de tout hook ouvre une passe **détachée**, refermée au
retour à `idle`.

La règle qui ferme la classe, et qu'il faut vérifier à chaque modification :
**toute écriture qui allume `loading` a un titulaire, et toute restitution une
référence.** Le titulaire ne se déduit pas : `setSlice` reçoit la passe qui
écrit. `holds` dit qui tient la référence, `publishes && inFlight` dit si
quelqu'un travaille encore — **une attente détachée compte comme en vol** —, et
`recover()` rend **toutes** les passes qu'il abandonne. La propriété se vérifie
**à l'état quiescent** : `release` republie l'attente avant que l'adoption ne lui
rende un titulaire, et cette fenêtre d'une instruction est normale. Dix tours de revue ont raffiné un proxy pour cette question ; il n'y en
a pas de bon, et il n'y en a pas non plus pour « ce fait est-il durable ? ». Une passe qui retombe en laissant l'attente allumée la fait
réadopter ; c'est ce qui rend inatteignable le repli de `recover()`, lequel
rendrait contre l'état courant — c'est-à-dire ne rendrait rien.

Toute modification de `dispatch`, `setSlice`, `release` ou `recover` commence par
un test dans `flags.test.ts`, et se vérifie avec **deux passes ouvertes en même
temps** : c'est la configuration où toutes les tentatives précédentes ont cédé.

## Pièges déjà rencontrés

- **`watch` est un champ de classe**, pas un accesseur. `override get watch()`
  dans une sous-classe de `Behavior` ou d'`IValidator` est **silencieusement
  masqué** par le champ de la base : le behavior ne reçoit jamais
  `onDependencyChanged`, sans la moindre erreur. Assigner dans le constructeur,
  ou redéclarer le champ.
- **Les getters d'un littéral d'objet** doivent capturer l'instance
  (`const field = this`), sinon `this` n'est pas le contrôleur.
- **Les règles d'un validator ne tournent pas sur une valeur vide**, sauf
  `validateWhenEmpty`. Une règle qui décide elle-même de l'obligation doit le
  déclarer.
- **`FormSnapshot.equals` et `FieldSnapshot.equals` gouvernent la republication.**
  Ajouter un champ au snapshot sans l'ajouter à `equals`, c'est un état qui ne
  se propage jamais.
- **`erasableSyntaxOnly`** interdit `enum` et les paramètres-propriétés de
  constructeur. **`verbatimModuleSyntax`** impose `import type`.
