# slz-form-event

> ⚠️ **Pré-publication** — les packages sont construits et prêts, rien n'est encore sur npm.
> L'API peut encore bouger.

Un moteur de formulaires **agnostique de tout framework**, où l'interface est
pilotée par l'état plutôt que par des conditions éparpillées dans le JSX.

---

## Le problème

Chaque input d'une application réelle réclame la même dizaine de mécanismes.
Pris un par un, aucun n'est difficile. Assemblés, ils produisent ceci — un
simple select dont les options dépendent d'un autre champ :

```tsx
const [value, setValue] = useState("");
const [touched, setTouched] = useState(false);
const [error, setError] = useState<string>();
const [options, setOptions] = useState<Option[]>([]);
const [loadingOptions, setLoadingOptions] = useState(false);

useEffect(() => {
    setLoadingOptions(true);
    fetchModels(brand)
        .then((o) => { setOptions(o); setValue(""); })
        .finally(() => setLoadingOptions(false));
}, [brand]);

useEffect(() => {
    if (touched) setError(validate(value));
}, [value, touched]);

<select
    value={value}
    disabled={loadingOptions || isSubmitting || !brand}
    onChange={(e) => setValue(e.target.value)}
    onBlur={() => setTouched(true)}
>…</select>
{loadingOptions && <Spinner />}
{touched && error && <p className="error">{error}</p>}
```

Ce qui coûte cher n'est pas la longueur, c'est ce que ce code installe :

- **L'état métier vit dans le composant.** Le parent devient propriétaire de la
  valeur, du `touched`, des options. Il n'est plus déplaçable ni testable seul.
- **Les règles d'affichage sont recalculées à la main.** `disabled={loading || submitting || !brand}`
  est réécrit, légèrement différemment, dans chaque champ. Une règle qui change
  se corrige à N endroits.
- **Les dépendances entre champs sont implicites.** Rien ne dit que ce champ
  dépend de `brand` sauf un tableau de `useEffect` qu'il faut lire pour le
  découvrir.
- **Les états impossibles sont représentables.** Rien n'empêche `touched=false`
  avec un `error` affiché, ou un spinner pendant que le champ est déjà en erreur.
- **Le rendu déborde.** Remonter la valeur au parent pour le bouton submit fait
  re-rendre tous les autres champs à chaque frappe.
- **La logique est prisonnière de React.** La même règle métier devra être
  réécrite en Angular ou en Vue.

---

## Ce que le système apporte

Le même champ, avec le moteur :

```ts
// une fois, dans le module du formulaire
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string, sans cast
});
```

```tsx
<SelectField name="model" label="Modèle" required behaviors={[modelOptions]} />
```

Pas de `useState`, pas de `useEffect`, pas de spinner câblé à la main, pas de
`disabled` composé de trois booléens. Ce n'est pas seulement plus court — c'est
ce que ça rend impossible qui compte.

### L'UI est pilotée par des flags, sur des axes qui ne se contredisent pas

Les flags ne vivent pas sur un seul plan. Les mettre à plat dans un `Set`
produit des états impossibles : deux comportements qui émettent l'un `pristine`
et l'autre `error` donneraient `["pristine", "error"]`. Ils sont donc groupés
par **axe** :

| Axe | Valeurs | Nature | Qui l'émet |
|---|---|---|---|
| Validité | `pristine` · `valid` · `error` | exclusif | le Validator, seul |
| Activité | `idle` · `loading` | exclusif | Behaviors + Validator |
| Disponibilité | `locked` · `readonly` · `invisible` | cumulatif | Behaviors + Controller + vue |

Le composant ne décide de rien : il lit et se rend.

```tsx
if (!field.isVisible) return null;
<input disabled={field.isLocked} />
{field.isLoading && <Spinner />}
{field.showError && <p>{field.error}</p>}
```

Retirer un flag suffit à faire réagir l'UI. Aucun composant n'est modifié.

### La validité a une autorité unique

Seul le Validator produit l'axe validité. Aucun comportement ne peut le
contredire, donc il n'y a jamais d'arbitrage à faire entre deux sources qui ne
sont pas d'accord.

`IValidator<T>` est générique : le même contrat couvre texte, nombre, booléen,
liste d'options, fichier, date, heure et datetime — chaque validateur valide son
propre type, sans un seul cast.

### Les dépendances entre champs sont déclarées, et vérifiées

Un comportement liste les champs qu'il observe. Lire un champ non déclaré
**lève une erreur**, et un cycle de dépendances est rejeté au câblage plutôt que
découvert en boucle infinie.

Un champ peut lire les autres ; il ne peut jamais en écrire un. Les
verrouillages, masquages et rechargements croisés passent tous par cette
lecture, sans mutation.

### Un champ qui change ne re-rend pas les autres

Chaque champ a son propre abonnement et un snapshot stable par référence.
S'abonner au formulaire entier est un choix explicite, réservé à ce qui en a
besoin — un bouton submit, un récapitulatif.

### Rien n'est typé à la main, et rien de faux ne compile

Le formulaire déclare ce que vaut chaque champ ; behaviors et hooks en dérivent :

```ts
// src/form/car-configuration-form.ts        (≈ une slice)
export type CarFields = {
    brand: string;
    model: string;
    mileage: number;
    licence: File;
};

export const carForm = new FormController<CarFields>({ name: "car-configuration" });

export const { lookup, loadOptions, suggest, prefill } = behaviorsFor(carForm);
export const { useField, useFieldArray, useForm } = hooksFor(carForm);
```

Il n'y a plus de formulaire à nommer sur chaque champ, et `name` est vérifié —
y compris contre le **type** du champ :

```tsx
<NumberField name="mileage" />   // ✓
<NumberField name="brand" />     // ✗ ne compile pas : brand est un string
<TextField   name="typo" />      // ✗ ne compile pas : champ inexistant
```

C'est le prix assumé du narrowing : ajouter un champ coûte une ligne dans la map
en plus de celle dans la vue. En échange, aucun `as` dans le code consommateur.

### La logique s'écrit une fois, pour tous les frameworks

Le cœur ne connaît ni React, ni Angular, ni Vue. Chaque adapter se limite au
pont framework ↔ core. La règle métier ne sera pas réécrite trois fois.

---

## Ce qu'il n'est pas

Dire ce qu'un outil ne fait pas évite d'en attendre ce qu'il ne donnera pas.

- **Ce n'est pas une bibliothèque de composants.** Aucun style, aucun design
  system, aucun markup imposé. Le moteur produit un état ; le rendu reste
  entièrement à vous. Les composants de la démo sont des exemples, pas l'API.

- **Ce n'est pas un validateur de schéma.** Il ne remplace ni Zod ni Yup. Il
  n'invente pas de langage de règles : il orchestre les validateurs que vous
  écrivez — et peut parfaitement en encapsuler un.

- **Ce n'est pas un state manager généraliste.** Il ne gère pas l'état de votre
  application, seulement celui de vos formulaires. Il ne cherche pas à remplacer
  Redux ou Zustand, et ne se branche sur aucun d'eux.

- **Ce n'est pas une couche HTTP.** Il ne fait aucun appel réseau. Il orchestre
  les vôtres : quand les lancer, quoi verrouiller pendant, quoi faire du
  résultat.

- **Ce n'est pas un générateur de formulaires.** Pas de rendu depuis un JSON,
  pas de schéma déclaratif produisant une page. Vous écrivez votre vue.

- **Ce n'est pas un moteur de mise en forme de la saisie.** Masques de
  téléphone, d'IBAN ou de montant : la valeur affichée et la valeur stockée sont
  la même, et la position du curseur reste l'affaire de la vue.

- **Il ne fait pas encore de rendu serveur.** L'adapter React lit son état via
  `useSyncExternalStore` sans `getServerSnapshot` : le rendu côté serveur lève.

- **Ce n'est pas une abstraction de React.** Le cœur ignore l'existence de
  React. L'adapter React est mince et remplaçable, pas une couche de compatibilité.

- **Ce n'est pas encore publié.** Les packages existent et se construisent, mais
  aucun n'est sur npm à ce jour, et l'API peut encore bouger.

---

## Tout se branche par behavior et validator

C'est le parti pris central : **rien de ce qu'on sait faire avec `useState` et
un `useEffect` ne doit être impossible ici**, et rien ne doit obliger à modifier
le moteur.

Le partage des rôles est net. Le **behavior** réagit — il écrit une valeur,
publie des options, émet `loading`, `locked`, `readonly`, `invisible`. Le
**validator** juge — il est la seule autorité sur la validité.

Pour que ça tienne, le réacteur a une sonnette et le juge a des yeux :

| Besoin | Comment |
|---|---|
| Confirmer un mot de passe, ordonner deux dates | le validator déclare `watch` et lit `ctx.watched(...)` |
| `required` seulement dans certains cas | le validator décide, avec `validateWhenEmpty` |
| Une erreur renvoyée par le serveur | `ExternalValidator`, composé avec les règles métier |
| Un avertissement qui ne bloque pas | `report.warn(...)` |
| Router un message vers une snackbar | `report.error(msg, { code })`, et la vue lit `code` |
| Verrouiller tant qu'un autre champ n'est pas valide | `lockUntilValid({ watch })` |
| Lignes de facture, listes dynamiques | `form.array("lines")` — une ligne est un formulaire |

Ce critère est vérifié, pas affirmé : `packages/form/test/parity.test.ts`
reprend chaque cas et l'écrit avec un behavior ou un validator, **sans jamais
capturer le `FormController`**.

---

## Le modèle en trente secondes

```
FormRegister              tous les formulaires de l'app          (≈ root reducer)
  └── FormController      un formulaire, orchestre ses Fields    (≈ slice)
        ├── DependencyGraph   réactivité inter-champs, cycles rejetés au câblage
        └── FieldController   un input : valeur, interactions, flags, validité
              ├── IBehavior[]     réactions → retournent une tranche d'état
              ├── IValidator<T>   autorité de validité
              └── FieldSnapshot   ce que le composant rend
```

Les comportements courants sont fournis prêts à l'emploi, dérivés du formulaire
et donc entièrement typés : `loadOptions`, `suggest`, `lookup`, `prefill`,
`lockWhile`, `hideWhen`.

```ts
const { lookup, suggest, prefill } = behaviorsFor(carForm);

lookup({ field: "city", watch: ["postcode"], debounce: 400,
         fetch: ({ postcode }) => fetchCity(postcode) });   // postcode: string
```

Le même besoin peut toujours s'écrire à la main quand il sort de l'ordinaire —
le README du core montre [le même prefill dans ses trois
formes](packages/form/README.md#trois-façons-de-préremplir-un-champ) : classe de
behavior, avec validator, puis utilitaire.

📄 La modélisation complète, les arbitrages et les 25 invariants d'architecture
sont dans **[`docs/MODEL.md`](docs/MODEL.md)**.

---

## Structure du repo

Un dépôt, quatre packages publiables, une démo par framework.

```
packages/
  form/            → slz-form           moteur agnostique, zéro dépendance
  react-form/      → slz-react-form     adapter React (provider + 2 hooks)
  angular-form/    → slz-angular-form   à implémenter (contrat dans son README)
  vue-form/        → slz-vue-form       à implémenter (contrat dans son README)

examples/
  react/           démo React : le même formulaire avec le moteur et en useState

docs/MODEL.md      modélisation, arbitrages, invariants
```

| Tu fais du… | Lance | Le code est dans | L'adapter est dans |
|---|---|---|---|
| **React** | `npm run dev:react` | `examples/react` | `packages/react-form` |
| **Angular** | *à venir* | — | `packages/angular-form` |
| **Vue** | *à venir* | — | `packages/vue-form` |
| **Rien / autre** | — | — | `packages/form` s'utilise seul |

---

## Démarrer

```bash
npm install     # workspaces npm : tout est lié localement
npm run dev     # ouvre la démo React
```

La démo monte **tous les types de champ dans une seule vue** — texte, email,
textarea, nombre, select, select dépendant, multi-select, radio, checkbox,
fichier, date, heure, datetime, champ conditionnel, champ prérempli. Un onglet
montre l'implémentation avec le moteur, l'autre la même chose écrite en
`useState`, et un compteur de rendus par champ rend l'écart visible.

```bash
npm run typecheck      # les 3 workspaces
npm run lint
npm run build          # packages (tsup) puis démo (vite)
```

En développement, la démo pointe vers les **sources** des packages : modifier le
moteur recharge la démo à chaud, sans rebuild.

**Prérequis :** Node.js ≥ 20.19, npm.

---

## Contribuer et publier

La CI (`.github/workflows/ci.yml`) vérifie chaque PR : typecheck, lint, build des
packages et de la démo, contenu réellement publié (`npm pack --dry-run`), et une
passe end-to-end de la démo dans Chromium.

```bash
npm test                # tests unitaires du moteur
npm run test:e2e        # 43 assertions dans un vrai navigateur
```

Les versions sont gérées par [changesets](https://github.com/changesets/changesets) :

```bash
npm run changeset          # décrire le changement et son niveau de bump
npm run version:packages   # applique les bumps et écrit les CHANGELOG
npm run release            # build puis publication npm
```

Un changement du core bumpe automatiquement les adapters qui en dépendent —
c'est tout l'intérêt du dépôt unique. Le workflow `release.yml` est en
déclenchement **manuel** et requiert un secret `NPM_TOKEN` ; il propose une
simulation avant toute publication réelle.

---

## Utiliser les packages dans un autre projet

```bash
npm install slz-form slz-react-form
```

`slz-form` et `react` sont des **peer dependencies** de l'adapter : ton
application doit en résoudre une seule copie de chaque. Deux copies de React
cassent les hooks ; deux copies de `slz-form` cassent le test
`instanceof BehaviorState` du moteur, et les flags sont alors silencieusement
ignorés. Le README de chaque package détaille le point.

> Rien n'est encore publié sur npm. Les noms `slz-form`, `slz-react-form`,
> `slz-angular-form` et `slz-vue-form` sont libres.

## Licence

MIT — voir [LICENSE](LICENSE).

## Auteur

[@elhabibmhadjou-slz](https://github.com/elhabibmhadjou-slz)
