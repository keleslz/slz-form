---
id: installation
title: Brancher React
sidebar_position: 1
description: Déclarer le formulaire dans un module, en dériver des hooks typés, et écrire un premier composant de champ. Aucun provider requis.
---

# Brancher React

`slz-react-form` est un pont mince : un provider et quelques hooks. Il ne porte
aucune logique métier — elle vit tout entière dans le cœur.

```bash
npm install slz-form slz-react-form
```

## Le module du formulaire

Déclarez le formulaire et sa map de champs dans un module à part, puis
dérivez-en les hooks :

```ts
// src/form/signup-form.ts
import { FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

Les hooks rendus par `hooksFor` sont liés à ce formulaire et typés par sa map :
`name` n'accepte que les champs déclarés, et le type de la valeur est inféré. Il
n'y a **aucun provider à monter** et aucun formulaire à nommer sur chaque champ.

## Un composant de champ

```tsx
import { useField } from "./form/signup-form";

function EmailField() {
    const field = useField({
        name: "email",              // ← only names declared in SignupFields compile
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

`EmailValidator` est un validator que vous écrivez (voir
[Valider](../guides/validate.md)) ; `Spinner` est votre propre composant.

**Ajouter un champ au formulaire, c'est afficher un tel composant.** Le premier
rendu crée le champ ; monter le composant monte le champ ; démonter le composant
le démonte, ce qui retire sa valeur de `values()`.

Ensuite :

- les hooks en détail, et ce que chacun rend : [Les hooks](./hooks.md) ;
- les listes de lignes : [Listes répétables](./lists.md) ;
- le bouton de soumission : [Soumettre un formulaire](../guides/submit.md#in-react).

## Pas de rendu serveur, pour l'instant

`useField`, `useFieldArray` et `useForm` lisent leur état avec
`useSyncExternalStore` **sans** `getServerSnapshot` : `renderToString` lève
`Missing getServerSnapshot`. Affichez ces composants côté client uniquement.

Un formulaire déclaré au niveau d'un module, comme ci-dessus, est **un seul
objet par processus JavaScript**. Dans le navigateur, c'est ce qu'on veut. Sur un
serveur, il serait partagé par toutes les requêtes et tous les utilisateurs —
une raison de plus de garder les formulaires côté client.
