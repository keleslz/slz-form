---
id: the-problem
title: Le problème
sidebar_position: 1
description: Gérer un select dépendant sans répéter sa logique d'état dans chaque composant.
---

# Le problème

Cette page utilise un select de modèles de voiture pour montrer quelle logique slz-form prend en charge. Vous verrez comment sortir le chargement des options et l'état du champ d'un composant React.

Quand la marque change, vous devez charger les modèles disponibles. Le select a aussi besoin d'une valeur, de messages de validation et d'un état désactivé pendant le chargement ou la soumission. Un composant peut gérer ces besoins ainsi :

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

Cette approche fonctionne, mais vous laisse plusieurs éléments à coordonner :

- Le composant possède la valeur, l'état d'interaction et les options. Pour tester cette logique séparément, vous devez l'extraire de React.
- Chaque input répète des conditions de chargement, de soumission et de dépendance. Modifier une règle commune peut demander de changer plusieurs composants.
- La dépendance à `brand` est déclarée dans l'effet. Vous devez lire les effets pour retrouver toutes les relations entre champs.
- Des mises à jour indépendantes peuvent laisser des options, des messages ou un état de chargement périmés si vous ne les coordonnez pas, notamment quand les réponses arrivent dans le désordre.
- Si un parent contient toutes les valeurs, en modifier une peut provoquer un nouveau rendu du parent et de ses enfants.
- Les effets dépendent de React. Un autre framework demande sa propre intégration pour cette logique.

## Le même champ, avec le moteur

Un behavior est un objet qui réagit aux événements d'un champ. Ici, `loadOptions` crée un behavior qui charge les options du modèle quand la marque observée change. `watch` liste les champs dont les changements déclenchent le behavior. Cet exemple utilise le helper renvoyé par `behaviorsFor(form)`, qui vérifie les noms de champs et les types des callbacks à partir de votre déclaration de formulaire.

```ts
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string | undefined, sans cast
});
```

Associez-le à votre composant de select :

```tsx
<SelectField name="model" label="Modèle" required behaviors={[modelOptions]} />
```

`SelectField` est un composant de votre application, comme ceux de la démo. Il affiche toujours le select, l'indicateur de chargement et les messages, mais lit leur état dans le moteur. Un flag est un état nommé, comme `loading` ou `locked` ; le composant vérifie les flags au lieu de conserver des booléens séparés pour chaque règle.

## Ce que le système vérifie

Les validators vérifient les valeurs et signalent des erreurs ou des avertissements. `IValidator<T>` permet d'écrire une règle pour le type utilisé : chaînes, nombres, booléens, tableaux d'options, fichiers ou dates. Les behaviors peuvent modifier la valeur, les options et les flags de leur propre champ ; leur résultat ne contient pas de réglage de validité.

Les behaviors et les validators déclarent leurs dépendances dans `watch`. `ctx.watched(...)` lève une exception pour un nom non déclaré, et le graphe des dépendances rejette les cycles lors de l'enregistrement des champs. Le contexte donne accès aux autres champs en lecture et fournit au behavior des méthodes pour modifier son propre champ. Les lectures générales via `ctx.form` ne créent pas automatiquement de dépendance.

Chaque champ possède son abonnement et son snapshot, un objet qui décrit son état actuel. Le snapshot conserve la même référence tant que cet état ne change pas. La modification d'un champ indépendant ne notifie pas cet abonnement. Les dépendances déclarées et les rendus des parents React peuvent tout de même mettre à jour d'autres composants. Utilisez l'abonnement au formulaire entier pour les composants qui en ont besoin, comme un bouton d'envoi ou un récapitulatif.

Votre map de champs déclare les noms et les types de valeurs. Les helpers dérivés vérifient ces types : TypeScript détecte un nom mal orthographié ou une valeur incompatible. Les props de vos propres composants doivent également conserver ces contraintes. Voir [Premier formulaire](first-form.md).

Le cœur ne dépend d'aucun framework. Vous pouvez réutiliser les behaviors et les validators avec un autre framework en reliant sa vue aux contrôleurs.
