# slz-angular-form — à implémenter

Adapter Angular de [`slz-form`](../form). Pas encore écrit : ce dossier tient la
place et décrit le contrat.

## Ce que l'adapter doit fournir

Strictement le pont Angular ↔ core, **aucune logique métier** — elle vit dans
`slz-form` et n'est jamais réécrite par un adapter.

| Équivalent React | Forme Angular attendue |
|---|---|
| `FormProvider` | un `InjectionToken<FormRegister>` fourni à la racine |
| `useField` | un service ou une directive exposant le snapshot en `signal` |
| `useFieldArray` | un service exposant `rows`, `append`, `remove`, `move` |
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

Si l'adapter expose des `@Injectable`/directives, il devra être publié au
**Angular Package Format**, donc construit avec `ng-packagr` plutôt qu'avec le
`tsup` des autres packages. S'il se limite à des signals et des fonctions
factory, un build ESM standard suffit.

`slz-form` et `@angular/core` devront être des **peerDependencies** (voir le
README de `slz-react-form` pour la raison précise côté `slz-form`).
