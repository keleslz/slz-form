---
id: without-a-framework
title: Sans framework
sidebar_position: 8
description: Piloter le moteur depuis du JavaScript simple — lire un snapshot, s'abonner avec listen, écrire avec change — et gérer soi-même le cycle de vie des champs.
---

# Sans framework

Le cœur, `slz-form`, ne contient aucun framework. L'adapter React n'est qu'une
fine couche au-dessus de trois choses que tout champ et tout formulaire exposent
déjà, et vous pouvez les utiliser directement — depuis du DOM sans framework, un
web component ou un autre framework.

| Geste | Sur un champ | Sur un formulaire |
|---|---|---|
| **lire** l'état courant | `field.snapshot` (ou `field.getSnapshot()`) | `form.snapshot` (ou `form.getSnapshot()`) |
| **s'abonner** aux changements | `field.listen(callback)` → rend `unsubscribe` | `form.listen(callback)` → rend `unsubscribe` |
| **écrire** | `field.change(value)`, `field.focus()`, `field.blur()` | `form.submit()`, `form.reset()` |

## Un exemple complet

Un formulaire d'inscription à une newsletter en TypeScript et DOM simples — un
champ email et un bouton :

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}

const form = new FormController<{ email: string }>({ name: "newsletter" });
const email = form.field("email", { required: true, validator: new EmailValidator() });

const input = document.createElement("input");
const message = document.createElement("p");
const button = document.createElement("button");
button.textContent = "Subscribe";
document.body.append(input, message, button);

function renderEmail(): void {
    const snapshot = email.snapshot;
    const value = snapshot.value ?? "";
    if (input.value !== value) {
        input.value = value;
    }
    input.disabled = snapshot.hasFlag("locked");
    message.textContent = snapshot.hasFlag("error") ? (snapshot.error ?? "") : "";
}

function renderForm(): void {
    button.disabled = form.snapshot.hasFlag("submitting");
}

const stopEmail = email.listen(renderEmail);
const stopForm = form.listen(renderForm);

input.addEventListener("input", () => email.change(input.value));
input.addEventListener("focus", () => email.focus());
input.addEventListener("blur", () => email.blur());
button.addEventListener("click", async () => {
    if (await form.submit()) {
        await fetch("/api/newsletter", { method: "POST", body: JSON.stringify(form.values()) });
        form.reset();
    }
});

email.mount();
renderEmail();
renderForm();
```

À remarquer :

- **C'est le moteur qui porte la valeur.** `renderEmail` recopie
  `snapshot.value` dans la saisie, parce que la valeur peut changer sans
  l'utilisateur — un prefill, un lookup, `reset()`. Le `if` évite de réécrire la
  saisie pendant que l'utilisateur tape.
- **`change()` marque le champ touché ; `blur()` aussi.** C'est ce qui permet à
  l'erreur d'apparaître : sur un champ non touché, `error` reste éteint.
- **Le bouton lit le formulaire, la saisie lit le champ.** Chacun ne s'abonne
  qu'à ce qu'il affiche.
- **`submitting` ne dure que pendant `submit()`.** Pendant le `fetch` qui suit,
  le bouton est de nouveau actif ; si un second clic ne doit pas envoyer deux
  fois, suivez la requête vous-même — voir
  [`submitting` couvre la porte](submit.md#which-guard-for-the-button).

Quand le formulaire disparaît, désabonnez-vous et démontez :

```ts
function destroy(): void {
    stopEmail();
    stopForm();
    email.unmount();
}
```

## S'abonner

`listen(callback)` appelle `callback` de façon synchrone après chaque changement
du snapshot, sans argument — lisez `snapshot` à l'intérieur. Il rend une
fonction qui désabonne.

Un snapshot est immuable, et `snapshot` rend **le même objet** tant que rien ne
change. `previous === field.snapshot` vous dit donc si quelque chose a changé,
et `listen` + `getSnapshot` se branchent tels quels sur tout store qui attend
une paire abonnement/lecture (`useSyncExternalStore` en React, un readable
Svelte, un signal).

S'abonner à un champ n'abonne pas au formulaire, et inversement. Une frappe dans
un champ n'appelle que les abonnés de ce champ, ceux du formulaire, et ceux des
champs qui l'[observent](dependencies.md) — si leur propre état change à son
tour.

## Le cycle de vie d'un champ

| Appel | Quand | Ce qu'il fait |
|---|---|---|
| `form.field(name, params)` | une fois par champ | crée le champ (les appels suivants rendent le même champ et ignorent `params`) |
| `field.mount()` | la saisie apparaît | le champ rejoint le formulaire : il compte dans `form.values()` et dans le verdict, ses hooks `onMount` s'exécutent, son validator s'exécute |
| `field.unmount()` | la saisie disparaît | le champ quitte le payload et le verdict ; le travail en cours est annulé (`ctx.signal` est avorté) — sauf, aujourd'hui, l'attente d'un `DebouncedValidator` : sa règle s'exécute encore une fois, avec le signal avorté (un écart connu) |
| `field.reset(value?)` | repartir de zéro | restaure `initialValue` — ou la `value` passée —, non touché, et rejoue `onMount` |
| `field.update({ … })` | votre code change un réglage | voir ci-dessous |

`field.update(changes)` permet à votre code de changer, après la création :

| Clé | Effet |
|---|---|
| `value` | écrit la valeur **sans** marquer le champ touché (elle déclenche bien les behaviors `onChange`) |
| `required` | active ou désactive l'obligation |
| `options` | remplace la liste d'options |
| `locked` / `readOnly` | ajoute votre propre verrou ou lecture seule, en plus de ceux des behaviors |

Behaviors et validators sont fixés à la création du champ ; `update()` ne peut
pas les remplacer.

:::caution Pièges du cycle de vie
- `field.update()` ne fait rien sur un champ non monté.
- `field.change()` fonctionne avant `mount()`, mais est **ignoré en silence**
  après `unmount()`.
- `form.mount()` monte **tous** les champs créés jusque-là sur le formulaire — y
  compris un champ que vous avez démonté exprès, qui revient dans le payload.
  Montez les champs un par un si certains vont et viennent.
:::

## Lire l'état

Sur le snapshot d'un champ :

| Lecture | Donne |
|---|---|
| `value` | la valeur courante |
| `hasFlag(...)` / `hasAny(...)` | les [flags](../model/flags.md) |
| `flags` | tous les flags, en tableau — pratique pour déboguer |
| `errors` / `error` / `warnings` / `issues` | les messages du validator — voir [Valider](validate.md#issues-severity-and-code) |
| `options` | la liste d'options, pour un select ou un groupe radio |

`field.hasFlag(...)` et `field.hasAny(...)` existent aussi directement sur le
champ, comme raccourci de `field.snapshot.hasFlag(...)`.

Sur le snapshot du formulaire : `hasFlag(...)` / `hasAny(...)` avec les flags du
formulaire, `values` (comme `form.values()`), `errors` (messages bloquants par
nom de champ), `flags`, `status`.

## Les autres frameworks

Un adapter pour Angular, Vue ou n'importe quoi d'autre se résume à quatre
étapes : créer le champ à la création du composant, appeler `mount()` /
`unmount()` avec le cycle de vie du composant, brancher `listen` / `getSnapshot`
sur la réactivité du framework, et appeler `change` / `blur` / `focus` depuis les
événements de la saisie. L'adapter React, `slz-react-form`, en est un exemple
fonctionnel en quelques centaines de lignes.
