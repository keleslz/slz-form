---
id: le-probleme
title: Le problème
sidebar_position: 1
description: Ce qu'un select dépendant coûte réellement quand on l'écrit à la main.
---

# Le problème

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
- **Les règles d'affichage sont recalculées à la main.**
  `disabled={loading || submitting || !brand}` est réécrit, légèrement
  différemment, dans chaque champ. Une règle qui change se corrige à N endroits.
- **Les dépendances entre champs sont implicites.** Rien ne dit que ce champ
  dépend de `brand` sauf un tableau de `useEffect` qu'il faut lire pour le
  découvrir.
- **Les états impossibles sont représentables.** Rien n'empêche `touched=false`
  avec un `error` affiché, ou un spinner pendant que le champ est déjà en erreur.
- **Le rendu déborde.** Remonter la valeur au parent pour le bouton submit fait
  re-rendre tous les autres champs à chaque frappe.
- **La logique est prisonnière de React.** La même règle métier devra être
  réécrite en Angular ou en Vue.

## Le même champ, avec le moteur

```ts
// une fois, dans le module du formulaire
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string, sans cast
});
```

```tsx
<SelectField name="model" label="Modèle" required behaviors={[modelOptions]} />
```

Pas de `useState`, pas de `useEffect`, pas de spinner câblé à la main, pas de
`disabled` composé de trois booléens. Ce n'est pas seulement plus court — c'est
ce que ça rend **impossible** qui compte.

## Ce que le système garantit

**La validité a une autorité unique.** Seul le Validator la produit. Aucun
behavior ne peut le contredire, donc il n'y a jamais d'arbitrage entre deux
sources qui ne sont pas d'accord. `IValidator<T>` est générique : le même
contrat couvre texte, nombre, booléen, liste d'options, fichier, date, heure et
datetime — chaque validateur valide son propre type, sans un seul cast.

**Les dépendances sont déclarées, et vérifiées.** Un behavior liste les champs
qu'il observe. Lire un champ non déclaré **lève**, et un cycle est rejeté au
câblage plutôt que découvert en boucle infinie. Un champ peut lire les autres ;
il ne peut jamais en écrire un.

**Un champ qui change ne re-rend pas les autres.** Chaque champ a son propre
abonnement et un snapshot stable par référence. S'abonner au formulaire entier
est un choix explicite, réservé à ce qui en a besoin — un bouton submit, un
récapitulatif.

**Rien n'est typé à la main, et rien de faux ne compile.** Le formulaire déclare
ce que vaut chaque champ ; behaviors et hooks en dérivent. Voir
[Premier formulaire](premier-formulaire.md).

**La logique s'écrit une fois, pour tous les frameworks.** Le cœur ne connaît ni
React, ni Angular, ni Vue. La règle métier ne sera pas réécrite trois fois.
