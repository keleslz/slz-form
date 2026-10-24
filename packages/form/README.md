# slz-form

Moteur de formulaires **agnostique de tout framework**. Zéro dépendance.

Il porte toute la logique — machine à états des champs, cycle de vie, behaviors,
validators, orchestration asynchrone, réactivité entre champs — et n'a
connaissance d'aucun framework. Les adapters (`slz-react-form`,
`slz-angular-form`, `slz-vue-form`) se limitent au pont framework ↔ core.

📖 **[Documentation complète](https://keleslz.github.io/slz-form/fr/)** —
guides, modèle, et référence d'API générée depuis les sources.

```bash
npm install slz-form
```

## En trente secondes

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Adresse email invalide");
    }
}

// la map déclare ce que vaut chaque champ : tout le reste s'infère
const form = new FormController<{ email: string; postcode: string; city: string }>({
    name: "signup",
});

const email = form.field("email", { required: true, validator: new EmailValidator() });
email.listen(() => console.log(email.snapshot.flags));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
```

Aucun framework requis : ce code tourne tel quel dans un navigateur, sous Node,
Deno ou Bun. `mount()` fait entrer le champ dans le formulaire (seuls les champs
montés comptent dans `form.values()` et dans le verdict), `change()` est ce
qu'appelle une saisie, `listen()` s'abonne aux changements du champ.

## L'idée

Ce qu'un champ **est** se lit en flags ; ce qu'il **contient** se lit en données.
Deux fonctions, et rien d'autre pour l'état :

```ts
field.hasFlag("loading", "invisible")   // ET  — toutes présentes
field.hasAny("locked", "readonly")      // OU  — au moins une
```

Les groupes `pristine · valid · error` et `idle · loading` **s'excluent** — une
union plate produirait des états impossibles. Tous les autres flags
**s'additionnent**, y compris ceux que votre application déclare elle-même par
`ctx.state.mark("skeleton")`, que le moteur transporte sans avoir à les
connaître.

## Où lire la suite

| | |
|---|---|
| Les flags, et les deux fonctions | [modèle](https://keleslz.github.io/slz-form/fr/docs/model/flags) |
| Behavior ou validator ? | [modèle](https://keleslz.github.io/slz-form/fr/docs/model/behavior-and-validator) |
| Préremplir, valider, dépendances, listes | [guides](https://keleslz.github.io/slz-form/fr/docs/guides/prefill) |
| Soumettre : `submit()` est une porte, pas un envoi | [guide](https://keleslz.github.io/slz-form/fr/docs/guides/submit) |
| Utiliser le moteur sans framework | [guide](https://keleslz.github.io/slz-form/fr/docs/guides/without-a-framework) |
| Signatures exactes | [référence API](https://keleslz.github.io/slz-form/fr/docs/reference/slz-form) |
| Arbitrages et invariants d'architecture | [`docs/MODEL.md`](https://github.com/keleslz/slz-form/blob/master/docs/MODEL.md) |

## Portée

**ESM uniquement** : le package n'expose pas de build CommonJS.

Ce que le moteur ne couvre pas — masques de saisie, rendu serveur — est listé
dans [« ce que ce n'est pas »](https://keleslz.github.io/slz-form/fr/docs#what-it-is-not).

## Licence

MIT
