# slz-form — modélisation du core

> Document de référence à valider. Il fixe l'objectif, les entités, les
> arbitrages tranchés et la façon dont chaque invariant est tenu.
> Statut : implémenté, couvert par `packages/form/test` (60 tests) ; le parcours
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

## 2. Le modèle d'état — trois axes

C'est la décision structurante, celle dont tout le reste découle.

Les flags ne vivent pas sur un seul plan. Une union naïve (`Set`) produit des
états impossibles : deux behaviors qui émettent l'un `pristine` et l'autre
`error` donnent `["pristine", "error"]`, qui n'est pas un état. Les flags sont
donc groupés par **axe** :

| Axe | Valeurs | Nature | Émetteur |
|---|---|---|---|
| Validité | `pristine` · `valid` · `error` | exclusif | le **Validator** seul |
| Activité | `idle` · `loading` | exclusif | les Behaviors + le Validator |
| Disponibilité | `locked` · `readonly` · `invisible` | cumulatif | les Behaviors + le Controller |

Règles de fusion, une par axe :

- **validité** ← le Validator, point. Aucun Behavior n'y touche : un seul
  émetteur, donc zéro conflit à arbitrer.
- **activité** ← `loading` dès qu'un Behavior *ou* le Validator est en vol.
- **disponibilité** ← union. Un seul `lock()` suffit à verrouiller.

**Conséquence directe : « supprimer un flag » devient défini.** Sur un axe
exclusif on remplace, sur l'axe cumulatif on cesse d'émettre. L'UI suit
mécaniquement, sans qu'aucun composant ne soit modifié.

La surface de lecture reste **plate** : `hasFlag("loading", "error")` fonctionne
comme prévu. L'axe est une structure interne, pas une contrainte consommateur.

```ts
field.hasFlag("locked")              // OU sur les flags donnés
snapshot.ui.hasEvery("valid", "idle")
snapshot.ui.flags                    // ["valid", "idle", "locked"] — projection plate
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
Lifecycle (`mount` / `update` / `unmount`), événements (`change` / `blur` /
`focus` / `submit`), lecture (`hasFlag(...)`, `snapshot`, `listen`, `view()`).

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

### Util — les fonctions nues
Couvrent les cas courants sans écrire de behavior :

| Fonction | Rôle |
|---|---|
| `loadOptions({ field, on, watch, debounce, fetch })` | charge les options : au montage, sur dépendance, ou à la frappe |
| `prefill(fetcher)` | remplit le champ au montage, verrouillé et `loading`, sans le marquer touché |
| `lockWhile(condition, watch)` | verrouillage conditionnel, y compris inter-champs |
| `lookup({ field, watch, debounce, fetch })` | appelle une API et **écrit** la valeur du champ |
| `suggest({ field, debounce, fetch })` | champ de recherche : suggestions à la frappe, sans verrou |
| `hideWhen(watch, predicate)` | émet `invisible` |
| `dependsOn(watch, effect)` | échappatoire générique pour toute réaction inter-champs |
| `createBehavior(def)` | typage d'un littéral de behavior |

`behaviorsFor(form)` en dérive des variantes typées, plus `lockUntilValid({ watch })`,
qui verrouille tant qu'un champ observé porte un constat bloquant.

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
| 1 | Merge des flags | 3 axes, fusion par axe | une union plate produit des états impossibles |
| 2 | Qui émet la validité | le Validator seul | invariant 13 ; supprime tout arbitrage entre behaviors |
| 3 | État du Behavior | le Behavior le **retourne**, le Controller le stocke | invariant 2 ; une instance partagée ne fuite pas entre champs |
| 4 | États intermédiaires async | `ctx.push(state)` | un `await` ne retourne rien |
| 5 | Câblage Form ↔ Field | `form.field(name)` — get-or-create | ajouter un champ reste une ligne dans la vue |
| 6 | Résolution du form | par **nom**, via le register en contexte | aucun composant n'importe un FormController |
| 7 | Réactivité inter-champs | `watch: string[]` + `DependencyGraph` | invariants 7 et 23 ; `ctx.watched()` **throw** sur un nom non déclaré |
| 8 | Cycles de dépendance | rejetés au wiring | une boucle est une erreur de conception, autant la voir tôt |
| 9 | `hasFlag(...)` | OU (`hasEvery` pour le ET) | usage dominant |
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
| 24 | Affichage vs verdict | `validity` reste `pristine` tant qu'on n'a pas touché ; `isBlocking` dit le vrai | un prefill ne doit pas allumer d'erreur, mais un formulaire prérempli et correct doit être soumettable |
| 25 | Champs répétables | une ligne **est** un formulaire, identifiée et non indexée | réutilise graphe, validation et soumission ; retirer ou déplacer une ligne ne renomme rien, donc aucun `watch` ne pointe dans le vide |

---

## 6. Où chaque invariant est tenu

| # | Invariant | Mécanisme |
|---|---|---|
| 1 | Core sans framework | aucun import non relatif dans `core/` |
| 2 | Contrôleurs source de vérité | `statesByBehavior` vit dans le Controller ; `BehaviorState` immuable |
| 3 | Aucun `useState` miroir | `useField` ne fait que `useSyncExternalStore` |
| 4 | `useSyncExternalStore` | `listen` / `getSnapshot` sont des références stables |
| 5 | Un Field ne modifie que son state | le contexte n'expose que `setValue` / `setOptions` du champ courant |
| 6 | Pas de mutation croisée | `watched()` rend un `FieldView` **en lecture seule** |
| 7 | Dépendances déclarées | `watch: string[]` ; `watched()` throw sur un nom non déclaré |
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
| 21 | Snapshot minimal | 10 champs, dont `options` — pas de sac fourre-tout `data` |
| 22 | Pas de rerender global | snapshot stable par référence + subscription par champ |
| 23 | Dépendance réactive explicite | idem 7 |
| 24 | FormController pas God Object | `DependencyGraph`, `FormSnapshot`, `FieldController` séparés |
| 25 | Composition plutôt que duplication | `Lifecycle` partagé Form/Field ; utils composés de behaviors |
| 26 | Le Validator lit, n'écrit pas | `ValidationContext` n'a aucune méthode de mutation ; `watched()` throw sur un nom non déclaré |
| 27 | Le moteur ne décide pas de l'affichage | il porte `severity` et `code` ; aucun libellé, aucune couleur, aucun composant |
| 28 | Un axe s'enrichit, ne s'ouvre pas | `readonly` a rejoint la disponibilité ; aucun sac à flags libres, qui recréerait le `Set` plat |
| 29 | Masqué vaut absent | un champ `invisible` sort de la validité **et** du payload |
| 30 | Une ligne est un formulaire | `FieldArrayController` compose des `FormController` ; aucun nommage par chemins |

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
5. **Adapters Angular et Vue.** `packages/angular-form` et `packages/vue-form`
   n'ont encore que leur README : le contrat à implémenter y est décrit.
