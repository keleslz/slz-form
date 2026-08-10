# slz-form

Moteur de formulaires **agnostique de tout framework**. Zéro dépendance.

Il porte toute la logique — machine à états des champs, cycle de vie, behaviors,
validators, orchestration async, réactivité entre champs — et n'a connaissance
d'aucun framework. Les adapters (`slz-react-form`, `slz-angular-form`,
`slz-vue-form`) se limitent au pont framework ↔ core.

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

const form = new FormController({ name: "signup" });

const email = form.field("email", { required: true, validator: new EmailValidator() });
email.listen(() => render(email.snapshot));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
```

Aucun framework requis : ce code tourne tel quel dans un navigateur, sous Node,
Deno ou Bun.

## L'idée : l'UI est pilotée par des flags, groupés par axe

| Axe | Valeurs | Nature | Qui l'émet |
|---|---|---|---|
| Validité | `pristine` · `valid` · `error` | exclusif | le Validator, seul |
| Activité | `idle` · `loading` | exclusif | Behaviors + Validator |
| Disponibilité | `locked` · `invisible` | cumulatif | Behaviors + Controller |

Une union plate produirait des états impossibles (`pristine` + `error`). Le
découpage par axe rend la fusion déterministe et donne un sens précis au retrait
d'un flag : on remplace sur un axe exclusif, on cesse d'émettre sur l'axe
cumulatif. La lecture, elle, reste plate : `hasFlag("loading", "error")`.

## API

| Entité | Rôle |
|---|---|
| `FormRegister` | tous les formulaires de l'app (≈ root reducer) |
| `FormController` | un formulaire ; `form.field(name)` crée le champ à la volée |
| `FieldController` | valeur, interactions, flags et validité d'un input |
| `IBehavior` | réactions ; retourne sa tranche d'état, ne la stocke pas |
| `IValidator<T>` | autorité de validité, générique sur le type de valeur |

Behaviors prêts à l'emploi : `loadOptions`, `prefill`, `lockWhile`, `hideWhen`,
`dependsOn`, `createBehavior`.

📄 Modélisation complète, arbitrages et invariants d'architecture :
[`docs/MODEL.md`](https://github.com/keleslz/slz-form-event/blob/master/docs/MODEL.md)

## Licence

MIT
