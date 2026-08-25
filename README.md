# slz-form-event

> ⚠️ **Pré-publication** — les packages sont construits et prêts, rien n'est encore sur npm.
> L'API peut encore bouger.

Un moteur de formulaires **agnostique de tout framework**, où l'interface est
pilotée par l'état plutôt que par des conditions éparpillées dans le JSX.

📖 **[La documentation](https://keleslz.github.io/slz-form-event/)** — le
problème qu'il résout, les guides, le modèle, et la référence d'API générée
depuis les sources.

---

## En bref

Le composant ne décide de rien : il lit et se rend.

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

`hasFlag(...)` est le **ET**, `hasAny(...)` le **OU** — ce qui supprime
précisément le `disabled={loading || submitting || !brand}` recomposé à la main
dans chaque champ. Le bouton de soumission tient en un appel :

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

Ce que ça apporte, en quatre points :

- **les états impossibles ne sont pas représentables** — `pristine` et `error`
  s'excluent, comme `idle` et `loading` ;
- **la validité a une autorité unique** — seul le Validator la produit, donc
  aucun arbitrage entre deux sources qui ne sont pas d'accord ;
- **un champ qui change ne re-rend pas les autres** — abonnement par champ,
  snapshot stable par référence ;
- **rien de faux ne compile** — le formulaire déclare ce que vaut chaque champ,
  behaviors et hooks en dérivent, et aucun `as` n'est nécessaire côté
  consommateur.

Le détail, avec le code avant et après :
[le problème](https://keleslz.github.io/slz-form-event/docs/demarrer/le-probleme).

---

## Structure du repo

Un dépôt, quatre packages publiables, une démo par framework.

```
packages/
  form/            → slz-form           moteur agnostique, zéro dépendance
  react-form/      → slz-react-form     adapter React (provider + hooks)
  angular-form/    → slz-angular-form   à implémenter (contrat dans son README)
  vue-form/        → slz-vue-form       à implémenter (contrat dans son README)

examples/
  react/           démo React : le même formulaire avec le moteur et en useState

website/           le site de documentation (Docusaurus + TypeDoc), hors workspaces
docs/MODEL.md      modélisation, arbitrages, invariants
```

| Tu fais du… | Lance | Le code est dans | L'adapter est dans |
|---|---|---|---|
| **React** | `npm run dev:react` | `examples/react` | `packages/react-form` |
| **Angular** | *à venir* | — | `packages/angular-form` |
| **Vue** | *à venir* | — | `packages/vue-form` |
| **Rien / autre** | — | — | `packages/form` s'utilise seul |

---

## Démarrer

```bash
npm install     # workspaces npm : tout est lié localement
npm run dev     # ouvre la démo React
```

La démo monte **tous les types de champ dans une seule vue** — texte, email,
textarea, nombre, select, select dépendant, multi-select, radio, checkbox,
fichier, date, heure, datetime, champ conditionnel, champ prérempli. Un onglet
montre l'implémentation avec le moteur, l'autre la même chose écrite en
`useState`, et un compteur de rendus par champ rend l'écart visible.

```bash
npm run typecheck      # les 3 workspaces
npm run lint
npm test               # tests unitaires du moteur
npm run test:e2e       # 43 assertions dans un vrai navigateur
npm run build          # packages (tsup) puis démo (vite)
```

En développement, la démo pointe vers les **sources** des packages : modifier le
moteur recharge la démo à chaud, sans rebuild.

**Prérequis :** Node.js ≥ 20.19, npm.

### Le site de documentation

Il vit dans `website/`, **hors** des workspaces : Docusaurus tire beaucoup de
dépendances, et les jobs de CI du moteur n'ont pas à les payer.

```bash
npm install            # à la racine d'abord : TypeDoc lit les sources par ce chemin
cd website && npm install && npm start
```

La référence d'API est générée par TypeDoc à chaque build et n'est pas commitée.

---

## Contribuer et publier

La CI (`.github/workflows/ci.yml`) vérifie chaque PR : typecheck, lint, build des
packages et de la démo, contenu réellement publié (`npm pack --dry-run`), et une
passe end-to-end de la démo dans Chromium. `docs.yml` construit le site et
échoue sur un lien mort.

**Les messages de commit sont en anglais** — titre, corps, et titres de PR.
C'est la seule chose du dépôt qui l'est ; documentation et commentaires restent
en français.

Les versions sont gérées par [changesets](https://github.com/changesets/changesets) :

```bash
npm run changeset          # décrire le changement et son niveau de bump
npm run version:packages   # applique les bumps et écrit les CHANGELOG
npm run release            # build puis publication npm
```

Un changement du core bumpe automatiquement les adapters qui en dépendent —
c'est tout l'intérêt du dépôt unique. Le workflow `release.yml` est en
déclenchement **manuel** et requiert un secret `NPM_TOKEN` ; il propose une
simulation avant toute publication réelle.

---

## Utiliser les packages dans un autre projet

```bash
npm install slz-form slz-react-form
```

`slz-form` et `react` sont des **peer dependencies** de l'adapter : ton
application doit en résoudre une seule copie de chaque. Deux copies de React
cassent les hooks ; deux copies de `slz-form` cassent le test
`instanceof BehaviorState` du moteur, et les flags sont alors **silencieusement**
ignorés. Le README de chaque package détaille le point.

> Rien n'est encore publié sur npm. Les noms `slz-form`, `slz-react-form`,
> `slz-angular-form` et `slz-vue-form` sont libres.

## Licence

MIT — voir [LICENSE](LICENSE).

## Auteur

[@elhabibmhadjou-slz](https://github.com/elhabibmhadjou-slz)
