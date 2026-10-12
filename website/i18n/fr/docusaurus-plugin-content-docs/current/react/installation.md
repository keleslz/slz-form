---
id: installation
title: Brancher React
sidebar_position: 1
description: Relier un formulaire aux hooks React et afficher l'état de ses champs.
---

# Brancher React

Cette page montre comment relier un formulaire à React et afficher un input validé. Vous créerez des hooks liés à un formulaire et relierez les événements de saisie et de blur au contrôleur du champ.

`slz-react-form` relie les contrôleurs du cœur aux abonnements et aux effets du cycle de vie React. Un contrôleur conserve l'état d'un formulaire ou d'un champ et exécute ses règles configurées. Vos composants choisissent le HTML et les styles.

```bash
npm install slz-form slz-react-form
```

L'adaptateur demande React ≥ 18. Pour la préparation pendant la pré-publication et la démo locale, voir [Installation](../getting-started/installation.md).

## Le module de formulaire

La map des champs est le type qui associe chaque nom de champ à son type de valeur. Déclarez-la avec le formulaire dans un module, puis appelez `hooksFor` pour créer les hooks de ce formulaire :

```ts
// src/form/signup-form.ts
import { FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

Le `useField` dérivé vérifie que `name` appartient à `SignupFields` et déduit le type de valeur. Il connaît déjà le formulaire à utiliser ; ces hooks fonctionnent donc sans provider.

`FormRegister` conserve des formulaires par nom pour y accéder ailleurs dans l'application. Si des composants éloignés ont besoin de ce registre, `FormProvider` le rend disponible via le contexte React, et `useFormRegister` le récupère. C'est facultatif pour les hooks créés avec `hooksFor`.

## Un champ

`useField` crée ou retrouve le contrôleur du champ et le monte dans un effet. Un validator vérifie sa valeur et signale des erreurs ou des avertissements ; définissez `EmailValidator` comme dans [Premier formulaire](../getting-started/first-form.md). `Spinner` est un composant fourni par votre application.

Un flag est un état nommé, comme `locked` ou `loading`. Lisez les flags avec `hasFlag` pour choisir l'affichage de l'input et des messages :

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

Le nom du champ doit d'abord exister dans la map TypeScript. Le contrôleur est créé au premier appel de `useField` pour ce nom et monté par l'effet du hook ; la map ne crée aucun champ à l'exécution. Démonter le composant démonte le champ.

Le validator, les behaviors et la configuration initiale sont lus à la création du contrôleur. Recréer un validator pendant un rendu ne remplace pas celui du contrôleur existant. Utilisez les props de mise à jour prises en charge par le hook, comme `required`, `locked` et `readOnly`, pour les réglages qui changent avec la vue.

Voir [Les hooks](./hooks.md) pour les abonnements et la lecture d'état, et [Listes répétables](./lists.md) pour les lignes.

## Le rendu côté client

`useField`, `useFieldArray` et `useForm` appellent `useSyncExternalStore` sans `getServerSnapshot`. Le rendu serveur avec `renderToString` lève `Missing getServerSnapshot`. Montez les composants qui utilisent ces hooks côté client.
