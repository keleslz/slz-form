# slz-form — modélisation du core

> Document de référence à valider. Il fixe l'objectif, les entités, les
> arbitrages tranchés et la façon dont chaque invariant est tenu.
> Statut : implémenté, couvert par `packages/form/test` (249 tests) et `packages/react-form/test` (19 tests) ; le parcours
> navigateur (`examples/react`, 43 assertions) couvre le socle, pas encore les
> listes répétables ni `readonly`.

---

## 1. Objectif

Éliminer le code répétitif réécrit à chaque input d'une application front :
`value`/`onChange`, `touched`/`blur`, état de validation, verrouillage pendant
un appel async, prefill depuis une API, spinner, `disabled` pendant la
soumission, options chargées en API, champs conditionnels.

Le principe directeur : **on déclare ce que le champ est et les comportements
qu'on lui branche ; le core orchestre le reste, et l'UI est pilotée par les
flags.** Un composant ne décide de rien — il lit un état et se rend.

Le core est en JS pur, sans aucune dépendance framework. Chaque framework a son
adapter au-dessus (React fourni ici ; Angular et Vue suivront le même contrat).

---

## 2. Le modèle d'état — des flags, et deux fonctions

C'est la décision structurante, celle dont tout le reste découle.

**Ce qu'un champ *est* se lit en flags ; ce qu'il *contient* se lit en données.**
La frontière est là et nulle part ailleurs : besoin du message d'erreur →
`errors` ; besoin de savoir s'il faut l'afficher → `hasFlag("error")`. Aucun
booléen d'état n'existe dans la surface de lecture (invariant 32) : un besoin de
`isX` signale un flag manquant ou un mot mal choisi, pas un accesseur à ajouter.

### Les deux fonctions

```ts
field.hasFlag("loading", "invisible")   // ET  — toutes présentes
field.hasAny("locked", "readonly")      // OU  — au moins une
```

Les mêmes deux, au champ comme au formulaire. Sans le ET, une condition composée
retombe sur des booléens — c'est très exactement ce qui s'était produit.

### Deux natures, une règle par nature

Une union naïve (`Set`) produit des états impossibles : deux behaviors qui
émettent l'un `pristine` et l'autre `error` donnent `["pristine", "error"]`, qui
n'est pas un état. D'où deux natures :

- **exclusive** — une valeur à la fois, poser l'une retire l'autre ;
- **cumulée** — un ensemble, l'union fait foi (un seul `lock()` verrouille), et
  **l'absence vaut défaut**.

**Conséquence directe : « supprimer un flag » devient défini.** Dans un groupe
exclusif on remplace, parmi les flags cumulés on cesse d'émettre. L'UI suit
mécaniquement, sans qu'aucun composant ne soit modifié.

### Les flags d'un champ

| Flag | Nature | Émetteur | Sens |
|---|---|---|---|
| `pristine` · `valid` · `error` | exclusive | le **Validator** seul | la validité **affichée** — `pristine` tant que le champ n'a pas été touché |
| `idle` · `loading` | exclusive | Behaviors + Validator | un travail est en vol |
| `locked` | cumulée | Behaviors + Controller + vue | grisé, hors saisie |
| `readonly` | cumulée | Behaviors + Controller + vue | lisible et sélectionnable, non modifiable |
| `invisible` | cumulée | Behaviors | pas rendu — et hors du formulaire (invariant 29) |
| `required` | cumulée | le Controller | obligatoire |
| `touched` · `focused` | cumulée | le Controller | l'interaction |
| `mounted` | cumulée | le Controller | fait partie du formulaire qu'on remplit |
| `submitting` | cumulée | le Controller | le formulaire est en train de partir — accompagne `locked` |
| *ceux de l'application* | cumulée | Behaviors | voir plus bas |

### Les flags d'un formulaire — les mêmes mots

| Flag | Nature | Sens |
|---|---|---|
| `valid` · `error` | exclusive | le **verdict** : le formulaire part, ou pas |
| `idle` · `submitting` · `submitted` | exclusive | où en est l'envoi — c'est `FormStatus` |
| `loading` | cumulée | un travail asynchrone est en vol quelque part |
| `touched` | cumulée | au moins un champ a été touché |

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

`idle` n'appartient pas au même groupe des deux côtés, et c'est voulu : au champ
il s'oppose à `loading` (un travail est en vol), au formulaire à `submitting`
(l'envoi est parti). Un formulaire peut donc être `idle` **et** `loading` — un
lookup tourne, mais rien n'est en cours d'envoi. Le bouton ci-dessus reste actif
dans ce cas, à raison : `submit()` fait partir le différé puis **attend** que
plus rien ne soit en vol avant de juger (arbitrage 19).

Une nuance, structurelle, à ne pas perdre : au **champ**, `error` est ce qu'on
*affiche*, et il reste éteint tant qu'on n'a pas touché — un prefill n'allume
rien. Au **formulaire**, il n'y a rien à afficher : `error` y est ce qui est
*vrai*, et un formulaire prérempli et faux ne part pas. C'est l'arbitrage 24,
tenu par cette répartition plutôt que par un booléen `isBlocking`. Le verdict
d'un champ pris isolément, c'est `errors` non vide.

Une **liste** suit la règle du formulaire, avec le vocabulaire du champ : elle
n'est jamais `pristine`, puisqu'elle n'est pas quelque chose qu'on touche.

### Les flags de l'application

Le vocabulaire du moteur ne peut pas prévoir les besoins d'un produit — un
skeleton, une vérification métier en cours. Un behavior publie donc les siens :

```ts
ctx.state.mark("skeleton")     //  … et  ctx.state.unmark("skeleton")
field.hasFlag("skeleton")      //  la vue en décide, le moteur transporte
```

**Uniquement du côté cumulé.** C'est là que deux behaviors s'additionnent sans
pouvoir se contredire, donc ouvrir est sans risque. Les groupes exclusifs, eux,
restent fermés : c'est là qu'on publierait un état qui n'existe pas.

La garde est dans le code, pas seulement dans la doc : `mark`, `unmark` **et le
constructeur de `BehaviorState`** refusent les mots du moteur
(`RESERVED_FLAGS`). Les trois, parce qu'un behavior *retourne* une tranche :
garder la porte sans garder le mur laissait `new BehaviorState("idle",
["error"])` republier l'état impossible. `mark("error")` publierait
`pristine` *et* `error` ; `mark("loading")` allumerait une activité que rien ne
pourrait éteindre, puisque l'union des flags cumulés ne se soustrait pas. Un
behavior émet la disponibilité — `lock()`, `readOnly()`, `hide()` — et ses
propres mots.

```ts
snapshot.flags   // ["valid", "idle", "mounted", "required", "touched"] — projection plate
```

---

## 3. Entités

```
FormRegister              tous les formulaires de l'app          (≈ root reducer)
  └── FormController      un formulaire, orchestre ses Fields    (≈ slice)
        ├── DependencyGraph   réactivité inter-champs, détection de cycles
        └── FieldController   un input : valeur, interactions, flags, validité
              ├── IBehavior[]     réactions          → émettent un BehaviorState
              ├── IValidator      validité           → autorité unique
              └── FieldSnapshot   ce que le consommateur rend
```

### FormRegister
Instanciable au niveau module, ne prend que des instances de `FormController` :
`new FormRegister({ values: [carForm, ...] })`. Il connaît l'état de tous les
formulaires (`snapshots()`), refuse les doublons de nom, et expose `require(name)`
qui échoue bruyamment sur une faute de frappe. C'est le fichier qui répond à
« quels formulaires a mon app ? ».

### FormController
`new FormController<CarFields>({ name })` — la map déclare ce que vaut chaque
champ, et le narrowing en découle partout. Orchestrateur des Fields et **endroit où un
field rejoint un form** : `form.field(name, params)` crée le champ au premier
appel et rend la même instance ensuite. Conséquence recherchée : ajouter un
input, c'est une ligne dans la vue, rien à déclarer en amont.

Il reste un coordinateur, pas un God Object : le graphe de dépendances est dans
`DependencyGraph`, l'état par champ dans chaque `FieldController`, l'agrégat
dans `FormSnapshot`.

### Lifecycle
Un seul objet, composé par le Form **et** par le Field. Trois états
(`idle` / `mounted` / `unmounted`) plutôt que deux booléens indépendants qui
peuvent diverger ; `isMounted` et `isUnmounted` en sont dérivés. `update(fn)`
n'exécute que si monté — le garde vit à un seul endroit.

### FieldController
```ts
new FieldController({ name, required?, requiredMessage?, requiredTrue?,
                      initialValue?, validator?, behaviors?, options? })
// validator : un IValidator, ou un tableau (arbitrage 23)
```
Lifecycle (`mount` / `update` / `unmount` / `reset`), événements (`change` /
`blur` / `focus` / `submit`), lecture (`hasFlag(...)` / `hasAny(...)`, `snapshot`, `listen`,
`view()`), et deux méthodes que le FormController pilote seul : `validateNow()`
et `recover()`.

Il est source de vérité pour **son** champ et rien d'autre : il peut lire le
form, jamais écrire dans un autre champ.

### IBehavior
```ts
interface IBehavior<T> {
    readonly watch?: readonly WatchTarget[];   // "postcode" | { field, on: [...] }
    onMount?, onChange?, onFocus?, onBlur?, onSubmit?,
    onDependencyChanged?, onUnmount?
}
```
Un hook retourne un `BehaviorState` (sa tranche), une promesse de `BehaviorState`,
ou rien — « rien » signifiant « je ne me prononce pas », la tranche précédente
est conservée.

`BehaviorState` est un **objet valeur immuable** : `ctx.state.loading().lock()`.
Le Behavior ne stocke pas l'état du champ ; il le retourne et le Controller le
range. Une instance peut porter de la **configuration** (une URL, un debounce),
jamais de l'état — sinon partager une instance entre deux champs les couplerait.

Pour muter avant/après un appel API, `ctx.push(state)` publie un état
intermédiaire : pendant un `await`, rien n'est retourné, donc `loading` ne
serait jamais visible autrement.

### IValidator
Classe abstraite **générique** : `IValidator<T>`. C'est ce qui lui permet de
couvrir texte, nombre, booléen, liste d'options, fichier, date, heure et
datetime — chaque sous-classe valide son propre `T`, sans un seul cast.

```ts
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!EMAIL.test(value), "Adresse email invalide");
    }
}
```
Les erreurs passent par un `ValidationReport` **propre à chaque run** : deux
validations async concurrentes entremêleraient leurs messages sinon. Un jeton de
run monotone garantit qu'un résultat périmé n'écrase pas un plus frais.

Le validator **déclare ce qu'il lit** et reçoit une vue en lecture, ce qui rend
la validation croisée exprimable sans sortir du modèle. Ses dépendances entrent
dans le même graphe que celles des behaviors : la règle est donc rejouée quand
sa dépendance change, sans que l'appelant s'en occupe.

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Ne correspond pas");
    }
}
```

Un constat porte une **gravité** et un **code**. `warn()` signale sans bloquer ;
le `code` permet à la vue de router — snackbar, sous le champ, ou nulle part.
Le moteur transporte, il ne décide pas de l'affichage.

Les validators se **composent** : `validator: [rules, serverIssues]`. Chaque
membre garde ses règles, leurs constats sont agrégés, et la validité reste
décidée par un validator. C'est ce qui permet à `ExternalValidator` de porter
une erreur serveur sans que l'invariant 13 bouge.

Une règle n'est pas consultée sur une valeur vide, sauf si elle déclare
`validateWhenEmpty` — nécessaire quand c'est elle qui décide de l'obligation
(« obligatoire si le compte est pro »).

**Ce qui se passe quand une règle casse** (invariant 31). Une règle qui lève, ou
dont la promesse rejette — un réseau tombé, une réponse illisible — n'a rendu
**aucun verdict**. Le moteur ne l'invente pas à sa place :

- ce que les autres règles ont déjà refusé est publié : un refus reste un refus,
  et les avertissements posés avant la panne aussi ;
- s'il n'y a aucun refus, la valeur est publiée **non vérifiée** : un constat
  bloquant de `code: "unverified"`. Deux réponses étaient tentantes et toutes
  deux fausses — la déclarer valide laisse passer ce que la règle aurait
  peut-être refusé, et garder le verdict précédent recolle à la valeur courante
  un jugement rendu sur une autre ;
- l'échec est signalé sur la console, jamais transformé en refus métier.

Une règle qui veut dire quelque chose de son propre échec le fait
explicitement, par `report.error(...)` ou `report.warn(...)` — c'est elle qui
sait si un réseau indisponible doit bloquer la soumission ou seulement
avertir.

### Util — les fonctions nues
Couvrent les cas courants sans écrire de behavior :

Deux formes pour chacune. Les **fonctions nues**, exportées, prennent le
fetcher en premier argument :

| Fonction nue | Rôle |
|---|---|
| `loadOptions(fetcher, params?)` | charge les options : au montage, sur dépendance, ou à la frappe |
| `lookup(fetcher, params?)` | appelle une API et **écrit** la valeur du champ |
| `prefill(fetcher)` | remplit le champ au montage, verrouillé et `loading`, sans le marquer touché |
| `lockWhile(condition, watch)` | verrouillage conditionnel, y compris inter-champs |
| `hideWhen(watch, predicate)` | émet `invisible` |
| `dependsOn(watch, effect)` | échappatoire générique pour toute réaction inter-champs |
| `createBehavior(def)` | typage d'un littéral de behavior |

Et les **variantes liées au formulaire**, rendues par `behaviorsFor(form)`, où
tout est inféré depuis la map — c'est la forme à privilégier :

| `behaviorsFor(form)` | Rôle |
|---|---|
| `loadOptions({ field, on, watch, debounce, fetch })` | idem, typé |
| `lookup({ field, watch, debounce, fetch })` | idem, typé |
| `suggest({ field, debounce, fetch })` | champ de recherche : suggestions à la frappe, sans verrou |
| `prefill({ field, fetch })` | idem, typé |
| `lockWhile({ watch, when })` · `hideWhen({ watch, when })` | conditions typées sur les champs observés |
| `lockUntilValid({ watch })` | verrouille tant qu'un champ observé porte un constat bloquant |

Nouvelle entité : **`FieldArrayController`**, obtenu par `form.array(name)`.
Une ligne est un `FormController` à part entière, identifiée et jamais indexée.

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();                  // rend un identifiant stable
lines.row(id).field("qty").mount();         // exactement l'API d'un formulaire
lines.row(id).field("qty").change(3);
lines.move(0, 1);                           // aucun renommage, donc aucun `watch` cassé
```

---

## 4. Comment un Field rejoint un Form

Le formulaire est déclaré dans un module contextualisé de l'app, et enregistré
une fois — exactement le découpage slice / root reducer / store :

```ts
// examples/react/src/form/car-configuration-form.ts   (≈ une slice)
export const CAR_CONFIGURATION_FORM = "car-configuration";
export const carConfigurationForm = new FormController({ name: CAR_CONFIGURATION_FORM });

// examples/react/src/form/index.ts                    (≈ le root reducer)
export const formRegister = new FormRegister({ values: [carConfigurationForm] });

// src/main.tsx                               (≈ <Provider store={store}>)
<FormProvider register={formRegister}><App /></FormProvider>
```

Dans la vue, **aucun composant n'importe une instance de form** : il en nomme
un, et le register le résout.

```tsx
<TextField form={CAR_CONFIGURATION_FORM} name="email" label="Email"
           required validator={new EmailValidator()} />
```

Ajouter un champ = ajouter cette ligne. Le module `form` n'est pas touché.

---

## 5. Arbitrages tranchés

| # | Point | Décision | Raison |
|---|---|---|---|
| 1 | Merge des flags | deux natures — exclusive, cumulée | une union plate produit des états impossibles |
| 2 | Qui émet la validité | le Validator seul | invariant 13 ; supprime tout arbitrage entre behaviors |
| 3 | État du Behavior | le Behavior le **retourne**, le Controller le stocke | invariant 2 ; une instance partagée ne fuite pas entre champs |
| 4 | États intermédiaires async | `ctx.push(state)` | un `await` ne retourne rien |
| 5 | Câblage Form ↔ Field | `form.field(name)` — get-or-create | ajouter un champ reste une ligne dans la vue |
| 6 | Résolution du form | par **nom**, via le register en contexte | aucun composant n'importe un FormController |
| 7 | Réactivité inter-champs | `watch: WatchTarget[]` + `DependencyGraph` | invariants 7 et 23 ; `ctx.watched()` **throw** sur un nom non déclaré |
| 8 | Cycles de dépendance | rejetés au wiring | une boucle est une erreur de conception, autant la voir tôt |
| 9 | `hasFlag(...)` | **ET** ; `hasAny(...)` pour le OU | sans le ET, une condition composée retombe sur des booléens — c'est ce qui s'était produit |
| 10 | `required` vs Validator | config déclarative, injectée en option au Validator | invariant 13 : la validité reste au Validator |
| 11 | Champ sans validator | un `DefaultValidator` est attaché d'office | un seul chemin pour la validité, zéro branche `if (validator)` |
| 12 | `isMounted` / `isUnmounted` | dérivés d'un statut à 3 états | deux booléens indépendants peuvent diverger |
| 13 | Type de valeur | `FieldController<T>` générique | permet un `IValidator<File>` ou `<Date>` sans cast |
| 14 | `locked` pendant la soumission | contribué par le Controller | évite que chaque consommateur re-dérive `isLocked \|\| isSubmitting` |
| 15 | `touched` | posé au `change` **et** au `blur` | validation vivante ; `pristine` garde son sens |
| 16 | Écriture programmatique | `ctx.setValue` ne marque pas touché | un prefill n'est pas une interaction utilisateur |
| 17 | Stabilité du snapshot | même référence tant que rien ne change | exigé par `useSyncExternalStore` ; sert l'invariant 22 |
| 18 | Déclenchement d'une dépendance | sur la **valeur** observée, pas sur son état | sinon revalider ou toucher un champ rejoue les lookups qui l'observent |
| 19 | Soumission et travail asynchrone | `submit()` fait partir le différé puis **attend** que plus rien ne soit en vol | toutes les valeurs doivent être posées avant qu'on juge le formulaire |
| 20 | Contexte du Validator | il déclare `watch` et reçoit une vue en lecture | la validation croisée était le seul besoin courant hors d'atteinte ; l'autorité n'est pas déplacée, le juge reçoit des yeux |
| 21 | Forme d'un constat | `{ message, severity, code? }` | le moteur transporte de quoi router, sans jamais décider où afficher |
| 22 | Déclencheurs de dépendance | un nom seul vaut `["value"]` ; `{ field, on }` ouvre le reste | garde l'arbitrage 18 comme défaut, et rend la réaction à l'état possible en la déclarant |
| 23 | Plusieurs validators | un tableau devient un composite, invisible pour l'appelant | promesse déjà faite ici et dans `.CLAUDE.md` ; permet aux erreurs serveur d'être un validator |
| 24 | Affichage vs verdict | le flag `error` du **champ** reste éteint tant qu'on n'a pas touché ; celui du **formulaire** est le verdict | un prefill ne doit pas allumer d'erreur, mais un formulaire prérempli et correct doit être soumettable — réparti sur deux niveaux plutôt que porté par un booléen `isBlocking` |
| 25 | Champs répétables | une ligne **est** un formulaire, identifiée et non indexée | réutilise graphe, validation et soumission ; retirer ou déplacer une ligne ne renomme rien, donc aucun `watch` ne pointe dans le vide |
| 26 | Règle qui casse | constat `unverified` bloquant, plutôt que « valide » ou que l'ancien verdict | déclarer valide laisse passer ce que la règle aurait refusé ; garder l'ancien verdict le recolle à une autre valeur |
| 27 | Surface de lecture | deux fonctions et des flags ; aucun booléen d'état | un booléen dérivé rend le flag facultatif, donc mort — c'est ce qu'avait fait `189b8de` en livrant l'API par flags et son contournement dans le même diff |
| 28 | Flags de l'application | `mark`, `unmark` et le constructeur refusent les mots du moteur | un vocabulaire fermé bloque les besoins qu'on n'a pas prévus ; l'union de flags cumulés ne peut pas se contredire, l'ouvrir est donc sans risque — mais poser `error` ou `loading` par ce chemin publierait un état impossible, d'où `RESERVED_FLAGS` |
| 29 | Verdict d'un champ | `errors` non vide, pas un flag | deux mots voisins — `error` affiché, `blocking` vrai — se confondaient à l'usage ; le verdict est déjà porté par une donnée que la vue lit de toute façon |
| 30 | Verdict d'une liste | comme le formulaire : `valid` / `error`, jamais `pristine` | une liste est un agrégat, pas un champ qu'on touche ; sa validité est ce qui est vrai |
| 31 | Travail en vol du formulaire | les champs **montés**, visibles ou non | la convergence attend un champ masqué ; un champ démonté, personne ne l'attend, et son activité ne redescendrait jamais |
| 32 | Rendre une ou N passes | ce que **cette** passe a ajouté, et rien d'autre (`Pass.added`) — un rejet en rend une, `recover()` les rend toutes | ce qu'elle a ajouté part, ce qu'elle a retiré reste retiré. L'intersection avec son état d'entrée disait la même chose tant qu'une seule passe écrivait ; à deux, elle effaçait ce qu'une sœur **vivante** avait posé depuis. Distinguer « fait durable » de « décoration transitoire » parmi ses propres ajouts n'est toujours pas observable : deux passes au flux identique — `verified`+`locked` d'un côté, `skeleton`+`invisible` de l'autre — exigeraient des issues opposées |
| 33 | Passe supplantée | une génération **par behavior**, capturée par la passe ; une passe plus ancienne n'écrit plus rien — ni tranche, ni valeur, ni options | sans ça, une promesse retombée après coup rasait la tranche qu'on venait de rendre. Par behavior et non par champ : `recover()` passe sur tous les champs montés dès que la convergence expire, et un compteur de champ rendait muet, définitivement, un voisin qui n'avait rien en vol |
| 34 | La dernière parole d'une passe | l'attente d'une passe dure jusqu'à ce qu'elle ait fini de parler : un hook synchrone parle une dernière fois en **poussant**, un hook asynchrone en **retombant** | une attente poussée en cours de route s'éteint donc avec la promesse, sauf si le hook la redéclare en sortie (`return ctx.state.loading()`). L'inverse — la garder par défaut — laissait une réponse périmée occuper le champ à vie, et c'est le cas fréquent ; deviner lequel des deux le behavior voulait est ce qui a coûté douze tours. Un envoi externe a deux façons de le dire, et les deux sont explicites : la redéclarer, ou la rallumer depuis son rappel |

---

## 6. Où chaque invariant est tenu

| # | Invariant | Mécanisme |
|---|---|---|
| 1 | Core sans framework | aucun import non relatif dans `packages/form/src` |
| 2 | Contrôleurs source de vérité | `statesByBehavior` vit dans le Controller ; `BehaviorState` immuable |
| 3 | Aucun `useState` miroir | `useField` ne fait que `useSyncExternalStore` |
| 4 | `useSyncExternalStore` | `listen` / `getSnapshot` sont des références stables |
| 5 | Un Field ne modifie que son state | le contexte n'expose que `setValue` / `setOptions` du champ courant |
| 6 | Pas de mutation croisée | `watched()` rend un `FieldView` **en lecture seule** |
| 7 | Dépendances déclarées | `watch` déclaré, behaviors **et** validators ; `watched()` throw sur un nom non déclaré, y compris pour un membre de composite |
| 8 | Contextes read-only | `FieldView` et `FormView` n'ont aucune méthode de mutation |
| 9 | Accès global au Form en lecture | `ctx.form` |
| 10 | Pas de subscription globale implicite | `FormView` n'a délibérément **pas** de `subscribe` |
| 11 | Réactivité locale | chaque champ a ses propres listeners |
| 12 | UI states composables | c'est exactement le découpage en axes |
| 13 | Validators déterminent la validité | les Behaviors ne peuvent pas émettre l'axe validité |
| 14 | Behaviors orchestrent les réactions | hooks de cycle de vie + `onDependencyChanged`, déclenché sur les axes **déclarés** — la valeur par défaut (arbitrage 22) |
| 15 | Adapters sans logique métier | `react/` = provider + hooks (`useField`, `useFieldArray`, `useForm`), zéro règle |
| 16 | Pas d'abstraction inutile | pas de couche « Field » séparée du Controller ; utils = fonctions nues |
| 17 | Configuration concise | un objet par behavior ; les dépendances déclarées **sont** ce que reçoit le callback |
| 18 | Behavior atomique ou composite | plusieurs behaviors par champ, chacun sa tranche |
| 19 | Aucun composant propriétaire du state | les composants ne reçoivent qu'un snapshot |
| 20 | Mutations croisées interdites | aucun chemin d'écriture vers un autre champ |
| 21 | Snapshot minimal | `name`, `value`, `ui`, `issues`, `options` — les flags portent le reste, pas de sac fourre-tout `data` |
| 22 | Pas de rerender global | snapshot stable par référence + subscription par champ |
| 23 | Dépendance réactive explicite | idem 7 |
| 24 | FormController pas God Object | `DependencyGraph`, `FormSnapshot`, `FieldController` séparés |
| 25 | Composition plutôt que duplication | `Lifecycle` partagé Form/Field ; utils composés de behaviors |
| 26 | Le Validator lit, n'écrit pas | `ValidationContext` n'a aucune méthode de mutation ; `watched()` throw sur un nom non déclaré |
| 27 | Le moteur ne décide pas de l'affichage | il porte `severity` et `code` ; aucun libellé, aucune couleur, aucun composant |
| 28 | Cumulé ouvert, exclusif fermé | un groupe exclusif ne prend que des valeurs déclarées — l'ouvrir recréerait le `Set` plat et ses états impossibles ; les flags cumulés acceptent ceux de l'application, où l'union ne peut pas se contredire |
| 29 | Masqué vaut absent | un champ `invisible` sort de la validité **et** du payload |
| 30 | Une ligne est un formulaire | `FieldArrayController` compose des `FormController` ; aucun nommage par chemins |
| 31 | Une passe interrompue n'est pas un verdict | une règle qui casse ne rend rien : la valeur est publiée **non vérifiée** et bloque, jamais valide, jamais jugée par le verdict d'une autre saisie |
| 32 | Aucun booléen d'état dans la surface de lecture | `FieldSnapshot`, `FormSnapshot`, `useField()` et `useForm()` n'exposent que `hasFlag` / `hasAny`, les données et les actions |
| 33 | Un groupe exclusif a un vocabulaire fermé | `ValidityFlag` et `ActivityFlag` sont des unions closes ; seuls les flags cumulés acceptent ceux de l'application, et `RESERVED_FLAGS` s'en dérive au lieu de les recopier |
| 34 | Le démontage n'abandonne rien en vol | `unmount()` neutralise les tranches **et** appelle `validator.abandon()` ; sans quoi un champ démonté restait `loading` pour toujours |
| 35 | Aucun hook ne peut faire dérailler le moteur | les sept hooks passent par `invoke`, la souscription à leur promesse aussi, et `isPromise` ne lève jamais — lire ou appeler `.then` d'un objet piégé ne sort ni de `mount()`, ni de `change()`, ni de `unmount()` |
| 36 | L'activité publiée suit le travail en vol | `Pass { generation, detached, added, wantsLoading }`. La tranche reste **partagée** par behavior — `ctx.state` la rend telle quelle, les helpers en dépendent — mais l'**intention** est par passe : `setSlice` reçoit la passe qui écrit et lui impute ce qui apparaît. L'activité en est **dérivée** — `loading` si et seulement si une passe ouverte la veut —, donc une sœur qui retourne `ctx.state.idle()` ne dit plus que « moi, j'ai fini » ; et `release` ne retire que `added`, donc ce qu'une sœur vivante a posé survit. Deux corollaires payés d'un mutant chacun : une passe retombée qui écrit encore — un rappel externe parle en son nom — **rouvre la sienne**, détachée, au lieu d'en ouvrir une anonyme qui ne saurait plus l'écouter ; et une passe **supplantée** lâche son attente sans rien rendre, ce qu'elle avait posé ayant déjà été effacé par ce qui l'a supplantée |
| 37 | Une intention déclarée n'est pas un écho | `BehaviorState.activityStated` : seul un `loading()` / `idle()` **appelé** vaut intention. `ctx.state` rend la tranche fusionnée, attente comprise : sans ce témoin, un `ctx.state.mark("badge")` posé pendant une attente la revendiquait sans le savoir, et un `push` de marqueur suffisait à la tenir |

---

## 7. Vérifié dans le navigateur

`examples/react` monte **tous les types de champ dans une seule vue** :
texte, email, textarea, nombre, select, select dépendant, multi-select, radio,
checkbox, fichier, date, heure, datetime, champ conditionnel, champ prefill.

Comportements vérifiés bout en bout : options chargées en API (`loading` +
`locked` au montage puis retour à `idle`), select dépendant rechargé et vidé,
prefill qui remplit sans marquer touché, `invisible` piloté par un flag,
verrouillage inter-champs sans mutation, validation synchrone et asynchrone, et
l'isolation des rendus (taper dans un champ laisse les compteurs des autres
inchangés).

---

## 8. Reste ouvert — à trancher

1. ~~**Noms de champs typés.**~~ Fait. `FormController<TFields>` porte la map,
   `behaviorsFor(form)` et `hooksFor(form)` en dérivent des helpers où tout est
   inféré. Prix assumé : ajouter un champ coûte une ligne dans la map en plus de
   celle dans la vue. En échange, plus aucun `as` côté consommateur, et un nom
   fautif ou du mauvais type ne compile pas.
2. ~~**Champs dynamiques** (field arrays, champs répétés).~~ Fait.
   `form.array(name)` rend un `FieldArrayController` dont chaque ligne est un
   `FormController`. Prix assumé : une ligne se monte et se démonte comme un
   formulaire. En échange, rien n'a été refondu — ni `FieldsShape`, ni
   `FieldNameOf`, ni `DependencyGraph` — et les identifiants stables rendent le
   réordonnancement inoffensif pour les dépendances déclarées.
3. ~~**Debounce.**~~ Fait. Deux mécanismes distincts, parce qu'ils tombent sur
   deux axes différents et qu'aucun ne peut faire le travail de l'autre :
   `DebouncedValidator` diffère un validator (qui *juge* une valeur), `lookup`
   diffère un behavior (qui *écrit* une valeur). `IValidator.flush()` permet au
   FieldController de trancher sans attendre au blur et à la soumission.
4. ~~**Packaging.**~~ Fait. `packages/form` et `packages/react-form` sont deux
   packages publiables, construits par tsup (ESM + `.d.ts`), avec changesets et
   CI. Reste à faire côté compte npm uniquement.
5. ~~**Le repos publié ne suit pas le travail réellement en vol.**~~ Fait.
   L'activité d'un champ n'est plus la dernière écriture d'un behavior mais une
   **dérivée** de ce que ses passes ouvertes veulent, et une restitution ne
   retire que ce que la passe rendue avait ajouté (invariants 36 et 37,
   arbitrages 32 et 34). Une sœur qui réussit n'éteint plus l'attente d'une
   autre, une sœur qui échoue ne défait plus ce qu'une passe vivante a écrit —
   donc un champ masqué ne rentre plus dans le payload et `submit()` n'aboutit
   plus avant convergence. Prix assumé : une passe asynchrone qui pousse
   `loading` puis retombe sans rien dire de l'activité **rend** l'attente ; pour
   la garder, elle la redéclare en sortie.

   Ce qui l'a fermé, après douze tours qui ne l'avaient pas fermé : le filet
   d'abord (`packages/form/test/passes.invariants.test.ts`, 49 paires de formes
   de hooks, deux oracles observables — soumis avant convergence, attente
   fuitée), vérifié **rouge sur le moteur d'avant** avant d'être déclaré vert
   sur celui d'après.

6. **Adapters Angular et Vue.** `packages/angular-form` et `packages/vue-form`
   n'ont encore que leur README : le contrat à implémenter y est décrit.
