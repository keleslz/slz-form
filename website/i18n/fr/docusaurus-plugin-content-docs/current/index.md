---
id: index
title: slz-form
sidebar_label: Vue d'ensemble
sidebar_position: 0
description: Gérer les valeurs, la validation et le chargement des champs indépendamment de la vue.
---

# slz-form

slz-form gère les valeurs des champs, leur validation et les opérations asynchrones de vos formulaires. Cette page explique comment vos composants lisent cet état et vous indique par où commencer pour créer un formulaire.

:::warning Pré-publication
L'API peut encore changer. Utilisez les [instructions pour le dépôt](getting-started/installation.md#depuis-le-dépôt) pour essayer les packages et la démo pendant le développement.
:::

Dans un formulaire de voiture, le select du modèle doit charger de nouvelles options quand la marque change. Il faut aussi le désactiver pendant le chargement, afficher les erreurs après une interaction et vérifier le formulaire avant de le soumettre. Quand chaque composant gère ces règles, vous finissez souvent par répéter des conditions comme celles-ci :

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

slz-form conserve cet état dans des contrôleurs de champs. Un contrôleur est l'objet qui stocke la valeur d'un champ, traite les interactions et exécute les règles configurées. Un flag est un état nommé, comme `loading` ou `locked`, que votre composant peut lire pour choisir son affichage. Les valeurs, les options et les messages d'erreur sont disponibles séparément.

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Un behavior est une fonction ou un objet qui réagit aux événements d'un champ, par exemple en chargeant les modèles quand la marque change. Un validator vérifie une valeur et signale des erreurs ou des avertissements. Vous les configurez sur le contrôleur ; votre composant utilise les flags et les données obtenus pour afficher un input.

`hasFlag(...)` renvoie `true` si tous les flags demandés sont présents. `hasAny(...)` renvoie `true` si au moins l'un d'eux est présent. Les champs et les formulaires proposent ces deux fonctions.

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

Ici, `valid` signifie que le formulaire n'a pas d'erreur bloquante, et `idle` qu'il est hors d'une soumission et n'a pas atteint `submitted`. Un formulaire peut être `idle` pendant qu'un champ est `loading` ; `submit()` attend les opérations concernées et valide avant de renvoyer son résultat. Cette méthode n'envoie pas de requête HTTP pour vous.

## Par où commencer

| Vous voulez… | Allez à |
|---|---|
| comprendre le code de composant remplacé | [Le problème](getting-started/the-problem.md) |
| installer les packages ou lancer la démo | [Installation](getting-started/installation.md) |
| créer votre premier formulaire | [Premier formulaire](getting-started/first-form.md) |
| lire l'état des champs et du formulaire | [Les flags](model/flags.md) |
| préremplir un champ depuis une API | [Préremplir un champ](guides/prefill.md) |
| consulter la signature d'une fonction | [Référence API](reference/slz-form/index.md) |
| lire les choix de conception | [Dossier de conception](/conception/MODEL) |

## Ce que vous fournissez

- Vos composants, votre HTML et vos styles. Les composants de la démo montrent une façon d'afficher l'état ; les packages ne fournissent pas de design system et ne génèrent pas de page depuis un JSON.
- Vos règles de validation. Vous pouvez écrire des validators directement ou appeler un validateur de schéma comme Zod ou Yup depuis l'un d'eux.
- Vos appels réseau. Les behaviors contrôlent quand vos fonctions sont exécutées et peuvent signaler un état de chargement ou de verrouillage pendant l'attente.
- L'état de votre application en dehors des formulaires. Le moteur gère les formulaires sans imposer de store global.
- L'intégration à votre framework. Le cœur ne dépend pas de React. L'adaptateur React relie les contrôleurs aux hooks, et un autre adaptateur peut utiliser la même logique de formulaire.

L'adaptateur React prend actuellement en charge le rendu côté client uniquement. Ses hooks appellent `useSyncExternalStore` sans `getServerSnapshot`, donc le rendu serveur lève une exception. Voir [Brancher React](react/installation.md).
