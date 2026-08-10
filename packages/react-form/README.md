# slz-react-form

Adapter React de [`slz-form`](https://www.npmjs.com/package/slz-form) : un
provider et deux hooks. Aucune logique métier — elle vit entièrement dans le core.

```bash
npm install slz-form slz-react-form
```

`slz-form` et `react` sont des **peer dependencies** : ton application doit en
résoudre une seule copie de chaque (voir « Pourquoi des peer dependencies » plus bas).

## Utilisation

Déclare tes formulaires dans un module, enregistre-les une fois, publie le
register — le même découpage qu'une slice, un root reducer et un store :

```ts
// src/form/signup-form.ts          (≈ une slice)
export const SIGNUP_FORM = "signup";
export const signupForm = new FormController({ name: SIGNUP_FORM });

// src/form/index.ts                 (≈ le root reducer)
export const formRegister = new FormRegister({ values: [signupForm] });
```

```tsx
// src/main.tsx                      (≈ <Provider store={store}>)
<FormProvider register={formRegister}>
    <App />
</FormProvider>
```

Ensuite, aucun composant n'importe une instance de formulaire — il en **nomme**
un, et le register le résout :

```tsx
function EmailField() {
    const field = useField<string>({
        form: SIGNUP_FORM,
        name: "email",
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
| `FormProvider` | publie le `FormRegister` dans l'arbre |
| `useField` | rattache un champ à son formulaire et l'expose à React |
| `useForm` | souscription au formulaire entier (bouton submit, récapitulatif) |
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
