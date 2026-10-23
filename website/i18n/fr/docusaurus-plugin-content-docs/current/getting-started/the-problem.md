---
id: the-problem
title: Le problème
sidebar_position: 1
description: Ce que coûte vraiment un select dépendant écrit à la main, et ce que le moteur garantit à la place.
---

# Le problème

Chaque saisie d'une vraie application réclame la même poignée de mécanismes :
une valeur, un état « touché », une erreur, parfois des options chargées depuis
une API, un spinner, un état désactivé. Pris un par un, aucun n'est difficile.
Mis ensemble, ils donnent ceci — un simple select dont les options dépendent
d'un autre champ :

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

Le coût n'est pas la longueur. C'est ce que ce code met en place :

- **Le composant porte l'état métier.** La valeur, `touched` et les options
  vivent dans le composant. Impossible de déplacer ou de tester cette logique
  seule.
- **Les règles d'affichage sont réécrites partout.**
  `disabled={loading || submitting || !brand}` revient, un peu différent, dans
  chaque champ. Une règle qui change se corrige à N endroits.
- **Les liens entre champs sont cachés.** Rien ne dit que ce champ dépend de
  `brand`, sauf un tableau de dépendances de `useEffect` qu'il faut aller lire.
- **Des états impossibles peuvent s'écrire.** Rien n'empêche une erreur
  affichée sur un champ jamais touché, ou un spinner sur un champ déjà en
  erreur.
- **Les rendus débordent.** Remonter la valeur au parent pour le bouton de
  soumission re-rend tous les autres champs à chaque frappe.
- **La logique est prisonnière de React.** La même règle devra être réécrite
  pour Angular ou Vue.

## Le même champ, avec le moteur

La réaction se déclare une fois, dans le module qui déclare le formulaire.
`loadOptions` est l'un des [behaviors](../index.md#vocabulary) prêts à l'emploi :

```ts
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string | undefined, no cast
});
```

La vue dit seulement quel champ elle affiche et ce qu'on lui branche
(`SelectField` est un composant de la démo, pas de la bibliothèque) :

```tsx
<SelectField name="model" label="Model" required behaviors={[modelOptions]} />
```

Plus de `useState`, plus de `useEffect`, plus de spinner câblé à la main, plus
de `disabled` fait de trois booléens. Pendant le chargement des options, le
champ porte `loading` et `locked` ; quand `brand` change, la sélection est
vidée et la liste se recharge.

## Ce que le moteur garantit

**Une seule source de validité.** Seul un validator décide si une valeur est
acceptée. Aucun behavior ne peut le contredire, il n'y a donc jamais de conflit
à arbitrer. `IValidator<T>` est générique : le même contrat couvre texte,
nombres, booléens, listes d'options, fichiers et dates, chaque validator jugeant
son propre type.

**Des dépendances déclarées.** Un behavior ou un validator liste dans `watch`
les champs qu'il lit, et il est relancé quand ils changent. Lire un champ par
`ctx.watched()` sans l'avoir déclaré **lève une erreur**, et un cycle de
dépendances est refusé à la création du champ, au lieu d'être découvert en
boucle infinie. Un champ peut lire les autres ; il ne peut jamais en écrire un.
Voir [Dépendances déclarées](../guides/dependencies.md).

**Un champ qui change ne re-rend pas les autres.** Chaque champ a son propre
abonnement et un snapshot qui garde la même référence tant que rien ne change.
S'abonner au formulaire entier est un choix explicite, pour ce qui en a besoin —
un bouton de soumission, un récapitulatif.

**Typé depuis une seule déclaration.** Le formulaire déclare ce que vaut chaque
champ ; behaviors et hooks en dérivent. Un nom mal orthographié ou une valeur du
mauvais type ne compile pas. Voir [Premier formulaire](first-form.md).

**Écrit une fois, pour tous les frameworks.** Le cœur ne connaît ni React, ni
Angular, ni Vue. Voir [Sans framework](../guides/without-a-framework.md).
