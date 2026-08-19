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
import { behaviorsFor, FormController, IValidator, type ValidationReport } from "slz-form";

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
email.listen(() => render(email.snapshot));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
```

Les behaviors se dérivent du formulaire, ce qui supprime les casts et les noms
répétés :

```ts
const { lookup, suggest } = behaviorsFor(form);

lookup({
    field: "city",
    watch: ["postcode"],
    debounce: 400,
    fetch: ({ postcode }) => fetchCity(postcode),   // postcode: string
});
```

Aucun framework requis : ce code tourne tel quel dans un navigateur, sous Node,
Deno ou Bun.

## L'idée : l'UI est pilotée par des flags, groupés par axe

| Axe | Valeurs | Nature | Qui l'émet |
|---|---|---|---|
| Validité | `pristine` · `valid` · `error` | exclusif | le Validator, seul |
| Activité | `idle` · `loading` | exclusif | Behaviors + Validator |
| Disponibilité | `locked` · `readonly` · `invisible` | cumulatif | Behaviors + Controller + vue |

Une union plate produirait des états impossibles (`pristine` + `error`). Le
découpage par axe rend la fusion déterministe et donne un sens précis au retrait
d'un flag : on remplace sur un axe exclusif, on cesse d'émettre sur l'axe
cumulatif. La lecture, elle, reste plate : `hasFlag("loading", "error")`.

---

## Trois façons de préremplir un champ

Le même besoin — remplir un champ depuis une API au montage — écrit de trois
manières, de la plus explicite à la plus courte. Les trois produisent
exactement le même comportement.

### 1. Une classe de behavior, sans validator

Le cas où l'on écrit tout soi-même. Utile pour comprendre ce que fait le
moteur, et nécessaire dès qu'un comportement sort de l'ordinaire.

```ts
import { Behavior, type BehaviorContext, type BehaviorState } from "slz-form";

class PrefillCustomerReference extends Behavior<string> {
    async onMount(ctx: BehaviorContext<string>): Promise<BehaviorState> {
        ctx.push(ctx.state.loading().lock());
        try {
            const reference = await fetchCustomerReference();
            if (!ctx.signal.aborted) {
                ctx.setValue(reference);
            }
        } catch {
            // un prefill qui échoue laisse le champ vide :
            // ce n'est pas une erreur de saisie, et le Validator reste seul juge
        }
        return ctx.state.idle().unlock();
    }
}

const form = new FormController<{ customerReference: string }>({ name: "account" });

const field = form.field("customerReference", {
    behaviors: [new PrefillCustomerReference()],
});
field.mount();
```

Ce qui se passe, dans l'ordre :

```
pendant l'appel   pristine, loading, locked
après l'appel     pristine, idle          ← valeur posée, champ toujours pristine
```

Le champ reste **`pristine`** : `ctx.setValue` ne marque pas le champ touché,
parce qu'une valeur venue d'une API n'est pas une interaction utilisateur.

`ctx.push` publie l'état d'attente **avant** l'`await` — sans lui, `loading` ne
serait jamais visible, puisque rien n'est retourné tant que la promesse n'a pas
résolu. Et `ctx.signal` est avorté au démontage : c'est ce qui empêche une
réponse tardive d'écrire dans un champ qui n'existe plus.

### 2. Le même behavior, avec un validator

On ajoute une règle. Rien ne change du côté du behavior : les deux ne se
marchent pas dessus, parce qu'ils n'agissent pas sur le même axe — le behavior
**écrit** une valeur, le validator la **juge**.

```ts
class ReferenceValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!/^CUST-\d{2}-\d{4}$/.test(value), "Format attendu : CUST-42-9013");
    }
}

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [new PrefillCustomerReference()],
});
```

```
après le prefill        pristine, idle     ← le validator ne s'est pas prononcé
l'utilisateur saisit    error, idle        ← « Format attendu : CUST-42-9013 »
il corrige              valid, idle
```

Le point à retenir : **une valeur préremplie ne déclenche pas d'erreur**. Le
champ n'ayant pas été touché, il reste `pristine` et n'affiche rien. Le
validator ne tranche qu'à partir de la première saisie — ou de la soumission,
qui touche tous les champs.

### 3. L'utilitaire, entièrement typé

Le cas courant, en trois lignes. `prefill` vient de `behaviorsFor(form)`, donc
tout est inféré depuis la map du formulaire.

```ts
const { prefill } = behaviorsFor(form);

const customerReferencePrefill = prefill({
    field: "customerReference",
    fetch: () => fetchCustomerReference(),
});

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [customerReferencePrefill],
});
```

Comportement identique au premier exemple — `loading` + `locked` pendant
l'appel, valeur posée, champ toujours `pristine`.

Ce qui est vérifié à la compilation :

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

Et sur un formulaire qui déclare `{ customerReference: string; mileage: number }`,
un fetch au mauvais type ne compile pas davantage :

```ts
prefill({ field: "mileage", fetch: async () => "pas un nombre" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

Un nom de champ fautif et un fetch au mauvais type sont des erreurs de
compilation, pas des surprises à l'exécution.


---

## Un besoin, un behavior ou un validator

Le principe : **tout comportement custom s'écrit avec l'un des deux**, sans
jamais toucher au moteur. Le behavior *réagit*, le validator *juge*.

### Le validator lit le formulaire

Il déclare ce qu'il observe, et se voit rejouer quand cela change.

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Ne correspond pas");
    }
}
```

`ctx.watched` **throw** sur un nom non déclaré : une dépendance réactive reste
explicite.

### Un constat porte une gravité et un code

```ts
report.error("Format attendu : CUST-42-9013", { code: "format" });
report.warn("Ce code postal semble inhabituel", { code: "unusual" });
```

Un avertissement ne bloque pas la soumission. Le `code` est là pour que **tu**
décides : snackbar, sous le champ, ou rien. Le moteur n'affiche jamais.

### Ce qui se passe quand une règle casse

Un réseau tombé n'est pas un verdict. Le moteur publie ce que les autres règles
ont refusé, conserve le dernier verdict connu plutôt que de déclarer le champ
valide, et signale l'échec sur la console. Une règle qui veut se prononcer sur
sa propre panne le fait elle-même :

```ts
protected async validate(value: string, report: ValidationReport) {
    try {
        const taken = await isTaken(value);
        report.errorIf(taken, "Déjà pris", { code: "taken" });
    } catch {
        report.warn("Vérification indisponible", { code: "offline" });
    }
}
```

### Plusieurs validators sur un champ

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// après un 422
serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
```

Les constats injectés s'effacent dès que la valeur change : une erreur serveur
porte sur ce qui a été envoyé, pas sur ce que l'utilisateur est en train de
corriger.

### Réagir à l'état d'un voisin, pas seulement à sa valeur

```ts
const { lockUntilValid } = behaviorsFor(form);

lockUntilValid({ watch: ["postcode"] });
```

En écrivant le behavior soi-même, on choisit les axes observés :

```ts
{ watch: [{ field: "postcode", on: ["validity"] }], onDependencyChanged: … }
```

Un nom seul reste déclenché par la **valeur** — c'est le défaut, et il évite
qu'une revalidation rejoue les appels réseau qui observent le champ.

### Champs répétables

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();

const qty = lines.row(id).field("qty");
qty.mount();                 // comme pour un champ de formulaire
qty.change(3);

lines.remove(id);
```

Une ligne **est** un formulaire : même API, même validation, mêmes behaviors.
Les lignes sont identifiées et jamais indexées, donc réordonner ne renomme rien.

Une règle qui porte sur l'ensemble se déclare sur le parent :

```ts
class SharesMakeAHundred extends IValidator<string> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;
    protected validate(_value, report, ctx) {
        const sum = (ctx.form.values().parts as { share: number }[])
            .reduce((total, part) => total + part.share, 0);
        report.errorIf(sum !== 100, `la somme fait ${sum}, pas 100`, { code: "sum" });
    }
}
```

---

## Champs dont le nom n'est pas un identifiant

Un champ peut s'appeler `Toto-1`, `2-champ` ou `champ avec espaces` : la map
accepte n'importe quelle clé, et le narrowing tient intégralement.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

Seule l'**écriture** du callback change, parce que JavaScript ne sait pas
destructurer un nom qui n'est pas un identifiant. Deux formes, l'une et l'autre
typées :

```ts
// destructuration avec renommage
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string, number

// ou accès par index
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

En revanche, ceci n'est pas du JavaScript valide :

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

`Toto-1` se lit comme `Toto` moins `1`. C'est une erreur de syntaxe, pas de
type — le compilateur échoue au parsing avant même de regarder les types.


## API

| Entité | Rôle |
|---|---|
| `FormRegister` | tous les formulaires de l'app (≈ root reducer) |
| `FormController` | un formulaire ; `form.field(name)` crée le champ à la volée |
| `FieldController` | valeur, interactions, flags et validité d'un input |
| `IBehavior` | réactions ; retourne sa tranche d'état, ne la stocke pas |
| `IValidator<T>` | autorité de validité, générique sur le type de valeur |

Behaviors prêts à l'emploi : `loadOptions`, `lookup`, `suggest`, `prefill`,
`lockWhile`, `hideWhen`, `dependsOn`, `createBehavior`. `behaviorsFor(form)` y
ajoute `lockUntilValid({ watch })`, typé sur la map du formulaire.

📄 Modélisation complète, arbitrages et invariants d'architecture :
[`docs/MODEL.md`](https://github.com/keleslz/slz-form-event/blob/master/docs/MODEL.md)

## Portée

**ESM uniquement** : le package n'expose pas de build CommonJS.

📄 Ce que le moteur ne couvre pas — masques de saisie, rendu serveur — est
listé dans la section « ce que ce n'est pas » du
[README du dépôt](https://github.com/keleslz/slz-form-event#ce-quil-nest-pas).

## Licence

MIT
