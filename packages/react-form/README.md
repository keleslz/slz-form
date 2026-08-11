# slz-react-form

Adapter React de [`slz-form`](https://www.npmjs.com/package/slz-form) : un
provider et deux hooks. Aucune logique métier — elle vit entièrement dans le core.

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

export const { useField, useForm } = hooksFor(signupForm);
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

    if (!field.isVisible) return null;

    return (
        <>
            <input
                value={field.value ?? ""}
                disabled={field.isLocked}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
            />
            {field.isLoading && <Spinner />}
            {field.showError && <p>{field.error}</p>}
        </>
    );
}
```

Ajouter un champ au formulaire, c'est monter ce composant. Rien à déclarer en amont.

## API

| Export | Rôle |
|---|---|
| `hooksFor(form)` | rend `useField` et `useForm` liés à un formulaire, typés par sa map |
| `FormProvider` | publie le `FormRegister` dans l'arbre, pour l'accès transverse |
| `useFormRegister` | accès direct au register |

`useField` ne fait que brancher le cycle de vie React sur le controller et lire
son snapshot via `useSyncExternalStore` : **aucun `useState` ne recopie l'état du
moteur**. Un champ qui change ne re-rend pas les autres — s'abonner au
formulaire entier est un choix explicite, réservé à ce qui en a besoin.

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
