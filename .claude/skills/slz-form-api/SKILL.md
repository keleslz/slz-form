---
name: slz-form-api
description: Règles de conception de l'API publique de slz-form. À charger avant toute modification de packages/form ou packages/react-form — ajout ou changement d'un behavior, d'un validator, d'un flag, d'un hook, d'une signature exportée — et avant de répondre à « comment fait-on X avec slz-form ? ». Contient les hard rules non négociables sur la simplicité de l'API, l'extensibilité par behavior et validator, et la séparation stricte entre le moteur agnostique et l'UI.
---

# Concevoir l'API de slz-form

## Hard rules

Elles ne se négocient pas. Une proposition qui en viole une est à réécrire, pas
à justifier.

### 1. L'API publique reste simple

- **Un objet de configuration par behavior.** Jamais de paramètres positionnels
  multiples, jamais de sous-objets imbriqués au-delà d'un niveau.
- Le nom du champ, ce qu'il observe, ce qu'il valide, comment il réagit : ça
  tient dans un objet plat et lisible.
- Une option nouvelle doit avoir un **défaut qui rend son absence invisible**.
- Devant le choix entre une option de plus sur un helper existant et un helper
  dédié au cas réel, prendre le helper dédié : `lockUntilValid({ watch })` bat
  `lockWhile({ watch, on, when })`.

### 2. Tout comportement s'exprime par un behavior et/ou un validator

C'est la raison d'être de la lib. Si un besoin exige de modifier le cœur, alors
**c'est le contrat d'extension qui est en défaut** — pas un cas particulier à
câbler en dur.

Devant un besoin non couvert, la question n'est jamais « où ajouter ce cas ? »
mais « quel trou du contrat d'extension l'empêche ? ».

### 3. Tout est composite

Plusieurs behaviors et plusieurs validators par champ, chacun gardant sa tranche
d'état ou ses règles. Aucune API ne doit supposer qu'il n'y en a qu'un.

### 4. Parité avec React nu

**Rien de ce qui est faisable avec `useState` et un `useEffect` ne doit être
impossible avec la lib.** C'est le critère d'acceptation, et il se vérifie :
`packages/form/test/parity.test.ts` reprend chaque cas et le réécrit avec un
behavior ou un validator.

Contrainte de ce fichier de test, qui est le cœur de la règle : **aucun cas ne
capture le `FormController` par closure.** Tout passe par `ctx`. Un cas qui
n'y arrive qu'en capturant le formulaire n'est pas couvert — il est contourné,
et le contournement contredit les invariants affichés par le projet.

### 5. Aucune UI/UX dans le moteur

- Le moteur transporte `code` et `severity`. Il ne décide **jamais** où ni
  comment afficher : snackbar, sous le champ, ou nulle part, c'est la vue.
- Il ne connaît ni skeleton, ni spinner, ni couleur, ni libellé.
- `packages/form/src` : **aucun import non relatif**. Pas de DOM, pas de
  framework. Seul `setTimeout` est utilisé comme global.
- Un adapter (`packages/react-form`) est un pont, pas un endroit où mettre des
  règles.

### 6. Zéro `as` dans le code consommateur

Le narrowing tient de bout en bout : nom de champ contraint à la map, valeur
inférée, `meta` inféré depuis le callback API.

Le typage n'est relâché qu'à **un seul endroit**, documenté comme tel :
`packages/react-form/src/useField.ts`, où `hooksFor` a déjà vérifié ce que la
fonction générique ne voit plus. Nulle part ailleurs.

### 7. Lire `docs/MODEL.md` avant, le mettre à jour après

Avant d'implémenter : lire les invariants et les arbitrages, pour savoir lequel
on s'apprête à toucher.
Après : consigner ce qui a changé — un arbitrage nouveau va dans §5, un
invariant nouveau **en fin** de la table du §6.

### 8. Ne jamais renuméroter les invariants

Le code les référence par numéro (`FieldController.ts:35` — « invariants 2, 5,
6 »). On **ajoute** à la fin. On ne réordonne pas, on n'insère pas.

---

## Le modèle, en bref

### Les trois axes

| Axe | Valeurs | Nature | Qui l'émet |
|---|---|---|---|
| Validité | `pristine` · `valid` · `error` | exclusif | le Validator, **seul** |
| Activité | `idle` · `loading` | exclusif | Behaviors + Validator |
| Disponibilité | `locked` · `readonly` · `invisible` | cumulatif | Behaviors + Controller + vue |

Une union plate produirait `pristine` + `error`, qui n'est pas un état. Le
découpage par axe rend la fusion déterministe et donne un sens au retrait d'un
flag : on remplace sur un axe exclusif, on cesse d'émettre sur l'axe cumulatif.

**Ajouter une valeur à un axe est légitime** (c'est ainsi que `readonly` est
arrivé). **Ouvrir un axe à des flags libres ne l'est pas** : ça recrée le `Set`
plat que le modèle existe pour écarter.

### Qui fait quoi

- **Behavior** — *réagit*. Écrit sa valeur, publie ses options, émet activité et
  disponibilité. Ne décide **jamais** de la validité.
- **Validator** — *juge*. Seule autorité sur la validité. Déclare `watch` pour
  lire d'autres champs, produit des constats portant `severity` et `code`.

Le partage des rôles tient parce que le réacteur a une **sonnette**
(`ctx.revalidate` via `requestRevalidation`) et le juge des **yeux**
(`ValidationContext`). Ne pas donner l'axe validité aux behaviors pour
« simplifier » : c'est ce qui rend les flags dignes de confiance.

### `validity` n'est pas le verdict

- `validity` est ce qu'on **affiche** : `pristine` tant que le champ n'a pas été
  touché, pour qu'un prefill n'allume pas d'erreur.
- `isBlocking` est ce qui est **vrai**, et c'est lui qui décide de `isValid`.

Ne pas les confondre, et ne pas « corriger » l'un en cassant l'autre.

### Une ligne est un formulaire

Les champs répétables n'ont pas de nommage par chemins. Une ligne est un
`FormController`, identifiée et jamais indexée. Retirer ou déplacer une ligne ne
renomme rien, donc aucun `watch` ne se met à pointer dans le vide.

---

## Réflexes

**Avant d'ajouter quoi que ce soit au cœur**, se demander : est-ce que ça
s'écrit avec un behavior ou un validator ? Si oui, ça n'a rien à faire dans le
moteur. Si non, quel trou du contrat l'empêche ?

**Un nouveau cas d'usage** commence par un test dans `parity.test.ts`, écrit
sans capturer le `FormController`. S'il ne passe pas, le manque est identifié
avant d'avoir écrit une ligne de moteur.

**Une correction de bug** commence par un test dans `regressions.test.ts`.

**Vérifier, toujours dans cet ordre :**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

puis le bout en bout, qui doit rester vert **sans modifier la démo** — c'est la
preuve qu'un changement est non cassant :

```bash
cd examples/react && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173 npm run test:e2e -w examples/react
```

## Pièges déjà rencontrés

- **`watch` est un champ de classe**, pas un accesseur. `override get watch()`
  dans une sous-classe de `Behavior` ou d'`IValidator` est **silencieusement
  masqué** par le champ de la base : le behavior ne reçoit jamais
  `onDependencyChanged`, sans la moindre erreur. Assigner dans le constructeur,
  ou redéclarer le champ.
- **Les getters d'un littéral d'objet** doivent capturer l'instance
  (`const field = this`), sinon `this` n'est pas le contrôleur.
- **Les règles d'un validator ne tournent pas sur une valeur vide**, sauf
  `validateWhenEmpty`. Une règle qui décide elle-même de l'obligation doit le
  déclarer.
- **`FormSnapshot.equals` et `FieldSnapshot.equals` gouvernent la republication.**
  Ajouter un champ au snapshot sans l'ajouter à `equals`, c'est un état qui ne
  se propage jamais.
- **`erasableSyntaxOnly`** interdit `enum` et les paramètres-propriétés de
  constructeur. **`verbatimModuleSyntax`** impose `import type`.
