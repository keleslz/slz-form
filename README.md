# slz-form-event

> ⚠️ **POC** — pas encore publié en package. Ce repo valide l'API et l'architecture avant extraction.

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

```tsx
<SelectField
    form={CAR_FORM}
    name="model"
    label="Modèle"
    required
    behaviors={[
        loadOptions(
            (ctx) => fetchModels(ctx.watched("brand")?.value as string | undefined),
            { watch: ["brand"] },
        ),
    ]}
/>
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
| Disponibilité | `locked` · `invisible` | cumulatif | Behaviors + Controller |

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

### Ajouter un champ est une ligne

Le formulaire est déclaré dans un module, enregistré une fois, publié à
l'application — le même découpage qu'une slice, un root reducer et un store :

```ts
// src/form/car-configuration-form.ts     (≈ une slice)
export const CAR_FORM = "car-configuration";
export const carForm = new FormController({ name: CAR_FORM });

// src/form/index.ts                       (≈ le root reducer)
export const formRegister = new FormRegister({ values: [carForm] });

// src/main.tsx                            (≈ <Provider store={store}>)
<FormProvider register={formRegister}><App /></FormProvider>
```

Aucun composant n'importe une instance de formulaire : il en **nomme** un, et le
register le résout. Ajouter un champ ne touche pas le module `form`.

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

- **Ce n'est pas une abstraction de React.** Le cœur ignore l'existence de
  React. L'adapter React est mince et remplaçable, pas une couche de compatibilité.

- **Ce n'est pas encore un package.** Aucun `npm install` aujourd'hui : le core
  est isolé mais pas publié, et l'API peut encore bouger.

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

Les comportements courants sont fournis en fonctions nues, sans rien à écrire :
`loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`.

📄 La modélisation complète, les arbitrages et les 25 invariants d'architecture
sont dans **[`src/slz-lib-v5/core/MODEL.md`](src/slz-lib-v5/core/MODEL.md)**.

---

## Lancer le POC

```bash
npm install
npm run dev
```

La page de démonstration monte **tous les types de champ dans une seule vue** —
texte, email, textarea, nombre, select, select dépendant, multi-select, radio,
checkbox, fichier, date, heure, datetime, champ conditionnel, champ prérempli —
et affiche les flags de chaque champ en direct, ainsi qu'un compteur de rendus
qui montre l'isolation.

```bash
npm run lint
npm run build   # ⚠️ voir ci-dessous
```

> `npm run build` échoue aujourd'hui, pour une raison antérieure à ce moteur :
> les itérations précédentes conservées dans `src/slz-lib` et `src/slz-lib-2`
> portent 43 erreurs TypeScript. `npm run dev` fonctionne, et `tsc` comme
> `eslint` sont verts sur l'intégralité de `src/slz-lib-v5`. Le build
> redeviendra vert à la suppression des anciennes itérations.

**Prérequis :** Node.js ≥ 20.19, npm.

---

## État du repo

| Dossier | Statut |
|---|---|
| `src/slz-lib-v5/core` | Moteur agnostique. Actif. |
| `src/slz-lib-v5/react` | Adapter React (provider + 2 hooks). Actif. |
| `src/form`, `src/page/showcase` | Démonstration côté application. |
| `src/slz-lib`, `src/slz-lib-2` | Itérations précédentes, conservées le temps de valider le modèle. À supprimer ensuite. |

## Auteur

[@elhabibmhadjou-slz](https://github.com/elhabibmhadjou-slz)
