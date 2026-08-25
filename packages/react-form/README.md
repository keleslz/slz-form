# slz-react-form

Adapter React de [`slz-form`](https://www.npmjs.com/package/slz-form) : un
provider et trois hooks. Aucune logique métier — elle vit entièrement dans le
core.

📖 **[Documentation complète](https://keleslz.github.io/slz-form-event/docs/react/installation)**

```bash
npm install slz-form slz-react-form
```

## Utilisation

Déclarez le formulaire et sa map dans un module, puis dérivez-en ses hooks — le
même découpage qu'une slice :

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
        </>
    );
}
```

Ajouter un champ au formulaire, c'est monter ce composant. Rien à déclarer en
amont.

`useField` ne fait que brancher le cycle de vie React sur le controller et lire
son snapshot via `useSyncExternalStore` : **aucun `useState` ne recopie l'état
du moteur**, et un champ qui change ne re-rend pas les autres.

## Où lire la suite

| | |
|---|---|
| Les hooks en détail | [documentation](https://keleslz.github.io/slz-form-event/docs/react/hooks) |
| Listes répétables | [documentation](https://keleslz.github.io/slz-form-event/docs/react/listes) |
| Signatures exactes | [référence API](https://keleslz.github.io/slz-form-event/docs/reference/slz-react-form) |

## Ce que l'adapter ne fait pas encore

**Pas de rendu serveur.** `useField`, `useFieldArray` et `useForm` lisent leur
état par `useSyncExternalStore` sans `getServerSnapshot` : un `renderToString`
lève `Missing getServerSnapshot`. À monter côté client uniquement pour l'instant.

**ESM uniquement.** Le package n'expose pas de build CommonJS.

## Pourquoi des peer dependencies

**`react`** : deux copies cassent les hooks (« Invalid hook call »). Classique.

**`slz-form`** : le moteur teste `result instanceof BehaviorState` pour appliquer
la tranche d'état renvoyée par un behavior. Avec deux copies du core, un
`BehaviorState` construit par l'une échoue le test dans l'autre — **les flags
sont alors silencieusement ignorés**, sans erreur ni crash. Le champ arrête
simplement de réagir.

En pratique : n'installez `slz-form` qu'une fois, à la racine de votre
application. Si vous utilisez `npm link` pour développer contre une copie
locale, ajoutez une déduplication explicite dans votre bundler
(`resolve.dedupe` chez Vite).

## Licence

MIT
