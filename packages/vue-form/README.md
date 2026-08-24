# slz-vue-form — à implémenter

Adapter Vue de [`slz-form`](../form). Pas encore écrit : ce dossier tient la
place et décrit le contrat.

## Ce que l'adapter doit fournir

Strictement le pont Vue ↔ core, **aucune logique métier** — elle vit dans
`slz-form` et n'est jamais réécrite par un adapter.

| Équivalent React | Forme Vue attendue |
|---|---|
| `FormProvider` | un `provide()` du `FormRegister` à la racine, `inject()` côté composant |
| `useField` | un composable renvoyant un `shallowRef` du snapshot |
| `useFieldArray` | un composable exposant `rows`, `append`, `remove`, `move` |
| `useForm` | idem, sur `FormController.snapshot` |

Points à respecter, identiques à l'adapter React :

- s'abonner via `controller.listen` / `controller.getSnapshot`, jamais recopier
  l'état dans un state local ;
- une souscription **par champ** — un champ qui change ne doit pas re-rendre les
  autres ;
- `mount()` au montage, `unmount()` à la destruction.

La **surface de lecture** est la même que côté React, et elle est courte : les
deux fonctions `hasFlag` (ET) et `hasAny` (OU), les données — `value`,
`options`, `errors` / `error` / `warnings` / `issues` —, les handlers et le
contrôleur. **Aucun booléen d'état** (invariant 32) : un adapter qui rajoute un
`isVisible` de confort réintroduit exactement ce que le moteur a retiré.

## Point d'attention spécifique

`shallowRef` plutôt que `ref` : le snapshot est déjà immuable et stable par
référence, une réactivité profonde le recopierait inutilement.

`slz-form` et `vue` devront être des **peerDependencies** (voir le README de
`slz-react-form` pour la raison précise côté `slz-form`).
