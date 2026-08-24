# slz-react-form

Adapter React de [`slz-form`](https://www.npmjs.com/package/slz-form) : un
provider et trois hooks. Aucune logique métier — elle vit entièrement dans le core.

```bash
npm install slz-form slz-react-form
```

`slz-form` et `react` sont des **peer dependencies** : ton application doit en
résoudre une seule copie de chaque (voir « Pourquoi des peer dependencies » plus bas).

## Utilisation

Déclare le formulaire et sa map de champs dans un module, puis dérives-en ses
hooks — le même découpage qu'une slice :

```ts
// src/form/signup-form.ts
export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

`name` est alors contraint aux champs déclarés, et la valeur est inférée. Il n'y
a ni provider à monter ni formulaire à nommer sur chaque champ :

```tsx
function EmailField() {
    const field = useField({
        name: "email",              // ← contraint à SignupFields
        required: true,
        validator: new EmailValidator(),
    });

    if (field.hasFlag("invisible")) return null;

    return (
        <>
            <input
                value={field.value ?? ""}
                disabled={field.hasFlag("locked")}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
            />
            {field.hasFlag("loading") && <Spinner />}
            {field.hasFlag("error") && <p>{field.error}</p>}
            {field.warnings.map((warning) => <small key={warning}>{warning}</small>)}
        </>
    );
}
```

Ajouter un champ au formulaire, c'est monter ce composant. Rien à déclarer en amont.

`field.issues` porte chaque constat avec sa `severity` et son `code`, ce qui
permet de router sans que le moteur s'en mêle :

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

L'état d'un champ se lit avec **deux fonctions**, et rien d'autre :

```tsx
field.hasFlag("locked", "required")   // ET  — toutes présentes
field.hasAny("loading", "invisible")  // OU  — au moins une
```

`readonly` est distinct de `locked` : lisible et sélectionnable, mais non
modifiable. La vue peut piloter les deux — `useField({ name, locked, readOnly })`.

Le formulaire répond aux mêmes deux fonctions, avec les mêmes mots :

```tsx
const { hasFlag, submit } = useForm();

<button disabled={!hasFlag("valid", "idle")} onClick={() => void submit()}>
    Envoyer
</button>
```

Une nuance à connaître : au champ, `error` est ce qu'on **affiche** — il reste
éteint tant qu'on n'a pas touché, pour qu'un préremplissage n'allume rien. Au
formulaire, `error` est ce qui est **vrai** : un formulaire prérempli et faux ne
part pas. Le verdict d'un champ pris isolément, c'est `field.errors` non vide.

### Tes propres flags

Le moteur ne peut pas prévoir les besoins d'un produit. Un behavior publie donc
les siens, et la vue en décide :

```tsx
// dans le behavior
ctx.push(ctx.state.mark("skeleton"));
// … puis, l'appel terminé
return ctx.state.unmark("skeleton");

// dans la vue
if (field.hasFlag("skeleton")) return <Skeleton />;
```

## Listes répétables

```tsx
function InvoiceLines() {
    const { rows, append, remove } = useFieldArray("lines");

    return (
        <>
            {rows.map((row) => (
                <fieldset key={row.id}>
                    <LineLabel row={row} />
                    <button onClick={() => remove(row.id)}>Retirer</button>
                </fieldset>
            ))}
            <button onClick={append}>Ajouter une ligne</button>
        </>
    );
}
```

Un champ de ligne se câble avec `useFieldOn`, en lui passant le formulaire de
la ligne :

```tsx
function LineLabel({ row }: { row: FieldArrayRow<InvoiceLine> }) {
    const field = useFieldOn(row.form, { name: "label", required: true });

    return (
        <input
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
        />
    );
}
```

`row.id` est stable : il ne change ni à la suppression d'une autre ligne, ni au
réordonnancement. C'est une clé React fiable, et c'est ce qui évite qu'un
déplacement casse les dépendances déclarées.

Le composant ne se re-rend que lorsque la **composition** de la liste change.
Taper dans une ligne ne re-rend pas les autres.

## API

| Export | Rôle |
|---|---|
| `hooksFor(form)` | rend `useField`, `useFieldArray` et `useForm` liés à un formulaire, typés par sa map |
| `useField` | un champ : valeur, constats, flags, handlers |
| `useFieldArray` | les lignes d'une liste répétable : `rows`, `append`, `remove`, `move`, `clear` |
| `useFieldOn(form, params)` | `useField` lié à un formulaire donné — sert à câbler un champ de ligne |
| `FormProvider` | publie le `FormRegister` dans l'arbre, pour l'accès transverse |
| `useFormRegister` | accès direct au register |

`useField` ne fait que brancher le cycle de vie React sur le controller et lire
son snapshot via `useSyncExternalStore` : **aucun `useState` ne recopie l'état du
moteur**. Un champ qui change ne re-rend pas les autres — s'abonner au
formulaire entier est un choix explicite, réservé à ce qui en a besoin.

## Ce que l'adapter ne fait pas encore

**Pas de rendu serveur.** `useField`, `useFieldArray` et `useForm` lisent leur
état par `useSyncExternalStore` sans `getServerSnapshot` : un
`renderToString` lève `Missing getServerSnapshot`. À monter côté client
uniquement pour l'instant.

**ESM uniquement.** Le package n'expose pas de build CommonJS.

## Pourquoi des peer dependencies

**`react`** : deux copies cassent les hooks (« Invalid hook call »). Classique.

**`slz-form`** : le moteur teste `result instanceof BehaviorState` pour appliquer
la tranche d'état renvoyée par un behavior. Avec deux copies du core, un
`BehaviorState` construit par l'une échoue le test dans l'autre — **les flags
sont alors silencieusement ignorés**, sans erreur ni crash. Le champ arrête
simplement de réagir.

En pratique : n'installe `slz-form` qu'une fois, à la racine de ton application.
Si tu utilises `npm link` pour développer contre une copie locale, ajoute une
déduplication explicite dans ton bundler (`resolve.dedupe` chez Vite).

## Licence

MIT
