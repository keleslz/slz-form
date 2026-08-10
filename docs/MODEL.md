# slz-form — modélisation du core

> Document de référence à valider. Il fixe l'objectif, les entités, les
> arbitrages tranchés et la façon dont chaque invariant est tenu.
> Statut : implémenté et vérifié dans le navigateur (`examples/react`).

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
| Disponibilité | `locked` · `invisible` | cumulatif | les Behaviors + le Controller |

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
`new FormController({ name })`. Orchestrateur des Fields et **endroit où un
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
new FieldController({ name, required?, requiredMessage?, initialValue?,
                      validator?, behaviors?, options? })
```
Lifecycle (`mount` / `update` / `unmount`), événements (`change` / `blur` /
`focus` / `submit`), lecture (`hasFlag(...)`, `snapshot`, `listen`, `view()`).

Il est source de vérité pour **son** champ et rien d'autre : il peut lire le
form, jamais écrire dans un autre champ.

### IBehavior
```ts
interface IBehavior<T> {
    readonly watch?: readonly string[];
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

### Util — les fonctions nues
Couvrent les cas courants sans écrire de behavior :

| Fonction | Rôle |
|---|---|
| `loadOptions(fetcher, { watch, lock, resetOnReload })` | charge les options en API ; `watch` en fait un select dépendant |
| `prefill(fetcher)` | remplit le champ au montage, verrouillé et `loading`, sans le marquer touché |
| `lockWhile(condition, watch)` | verrouillage conditionnel, y compris inter-champs |
| `hideWhen(watch, predicate)` | émet `invisible` |
| `dependsOn(watch, effect)` | échappatoire générique pour toute réaction inter-champs |
| `createBehavior(def)` | typage d'un littéral de behavior |

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
| 14 | Behaviors orchestrent les réactions | hooks de cycle de vie + `onDependencyChanged` |
| 15 | Adapters sans logique métier | `react/` = provider + 2 hooks, zéro règle |
| 16 | Pas d'abstraction inutile | pas de couche « Field » séparée du Controller ; utils = fonctions nues |
| 17 | Configuration concise | un seul objet, `name` seul obligatoire |
| 18 | Behavior atomique ou composite | plusieurs behaviors par champ, chacun sa tranche |
| 19 | Aucun composant propriétaire du state | les composants ne reçoivent qu'un snapshot |
| 20 | Mutations croisées interdites | aucun chemin d'écriture vers un autre champ |
| 21 | Snapshot minimal | 10 champs, dont `options` — pas de sac fourre-tout `data` |
| 22 | Pas de rerender global | snapshot stable par référence + subscription par champ |
| 23 | Dépendance réactive explicite | idem 7 |
| 24 | FormController pas God Object | `DependencyGraph`, `FormSnapshot`, `FieldController` séparés |
| 25 | Composition plutôt que duplication | `Lifecycle` partagé Form/Field ; utils composés de behaviors |

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

1. **Noms de formulaires et de champs typés.** Aujourd'hui `form: string`, une
   faute de frappe échoue au runtime (`require` throw). On peut dériver une map
   typée depuis le tableau du register via generics, au prix d'un peu de
   type-level. À arbitrer selon le goût pour l'ergonomie vs la simplicité.
2. **Champs dynamiques** (field arrays, champs répétés). `addField`/`removeField`
   existent (`form.field()` / `form.remove()`), mais aucun cas d'usage n'est
   encore éprouvé.
3. **Debounce.** Il n'y a pas encore de `DebouncedValidator` ; la validation part
   à chaque `change`. À ajouter comme util si le besoin se confirme.
4. **Packaging.** Le core est isolé mais pas encore un package séparé : pas de
   `exports`/`main`, pas de build lib. C'est l'étape qui rend `slz-form-event`
   réellement publiable indépendamment des adapters.
5. **Adapters Angular et Vue.** `packages/angular-form` et `packages/vue-form`
   n'ont encore que leur README : le contrat à implémenter y est décrit.
