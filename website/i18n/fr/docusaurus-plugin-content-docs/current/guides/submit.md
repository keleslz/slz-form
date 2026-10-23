---
id: submit
title: Soumettre un formulaire
sidebar_position: 3
description: form.submit() est une porte, pas un envoi — ce qu'il fait étape par étape, ce qu'il rend, comment garder le bouton, et comment afficher les erreurs du serveur.
---

# Soumettre un formulaire

`form.submit()` n'envoie rien. C'est une **porte** : il prépare le formulaire,
le juge, et répond `true` ou `false`. L'envoi, c'est votre code, une fois la
porte ouverte. Les exemples de cette page utilisent ce `signupForm`.

```ts
import { FormController } from "slz-form";

type SignupFields = { email: string; password: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export async function send(): Promise<void> {
    if (await signupForm.submit()) {
        await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
        signupForm.reset();
    }
}
```

## Ce que fait `submit()`

Dans l'ordre :

1. **Refuse une seconde soumission.** Si une soumission est déjà en cours,
   l'appel rend `false` tout de suite — un double clic pendant l'exécution de
   `submit()` rend `false` la seconde fois.
2. **Verrouille le formulaire.** Son statut passe à `submitting`, et chaque champ
   monté reçoit les flags `submitting` et `locked`. Ce sont des flags
   d'affichage : le moteur ne refuse pas un `change()` pendant ce temps, c'est
   à vos saisies de respecter `locked`.
3. **Touche chaque champ monté.** Chacun devient `touched` : un champ obligatoire
   jamais touché affiche maintenant son erreur. Ses hooks `onSubmit`
   s'exécutent, tout ce qui attendait un délai part tout de suite, et son
   validator est relancé. Les lignes de chaque liste passent par la même étape.
4. **Attend le travail en cours.** Un prefill ou un lookup encore en cours doit
   aboutir avant que le formulaire soit jugé, sinon vous enverriez une valeur
   pas encore posée. Un champ dont la valeur a changé pendant l'attente est
   revalidé. `settleTimeout` (10 secondes par défaut) borne l'étape 3 et cette
   attente, chacune de son côté — donc jusqu'à environ deux fois
   `settleTimeout` au total, plus les lignes de chaque liste, soumises entre
   les deux avec leur propre attente —, mais pas la seconde validation ; voir
   [Réglages](#settings).
5. **Juge.** Il rend `true` seulement si tout a abouti à temps et que le
   formulaire est `valid`. Le statut passe à `submitted` en cas de succès, à
   `idle` en cas d'échec, et les champs perdent le flag `submitting` et le
   verrou qui l'accompagnait.

Seuls les champs **montés** participent. Un champ masqué par un behavior
(`invisible`) est quand même validé et peut afficher ses erreurs, mais il ne
compte pas dans le verdict ; et comme il est monté, sa valeur **est** dans
`form.values()`.

## Quand il rend `false`

| Cause | Ce que vous voyez |
|---|---|
| un champ ou une ligne a un constat bloquant | les erreurs s'affichent (tous les champs sont maintenant touchés) ; `form.snapshot.errors` les liste par champ |
| le travail en cours n'a pas abouti dans le délai `settleTimeout` | les champs encore `loading` sont libérés ; `form.engineErrors` peut dire pourquoi. Une règle encore en cours retrouve son verdict précédent : le formulaire peut paraître `valid` jusqu'à l'exécution suivante — [un écart connu](../model/interrupted-pass.md) |
| une soumission était déjà en cours | rien ne change |

## Ce que vous envoyez : `form.values()` {#what-you-send-formvalues}

`form.values()` rend les valeurs de tous les champs **montés** — masqués compris
— et, pour chaque liste, le tableau des valeurs de ses lignes. Un champ non
monté en est absent. Pour exclure un champ que l'utilisateur ne voit pas,
démontez-le (en React, cessez d'afficher son composant). Cela vaut pour les
champs, pas pour les listes : dès que `form.array(name)` existe, la liste est
toujours dans le payload — démonter son composant ne démonte que les champs des
lignes, elle envoie donc `[{}, …]`. Appelez `clear()` sur la liste pour envoyer
`[]`.

Le résultat est typé `Readonly<Record<string, unknown>>` : la map de champs ne
s'y retrouve pas. Quand vous avez besoin d'une valeur typée, lisez-la sur son
champ :

```ts
const email = signupForm.get("email")?.snapshot.value;   // string | undefined
```

## Quelle garde pour le bouton {#which-guard-for-the-button}

Après un `submit()` réussi, le statut reste `submitted` jusqu'à `form.reset()`
ou au `submit()` suivant — modifier un champ ne le ramène pas à `idle`.
Choisissez la garde qui correspond à ce qui se passe après un envoi :

| Après un envoi réussi… | Garde |
|---|---|
| vous appelez `form.reset()` (le formulaire repart de zéro) | `disabled={!hasFlag("valid", "idle")}` |
| le formulaire reste affiché (enregistrer et continuer, erreurs serveur à afficher) | `disabled={hasFlag("submitting")}` |
| idem, et vous voulez aussi bloquer tant qu'il est invalide | `disabled={!hasFlag("valid") \|\| hasFlag("submitting")}` |

`!hasFlag("valid", "idle")` se lit « non (valide et au repos) » : le bouton est
désactivé tant que le formulaire est invalide **ou** pas au repos — en cours
d'envoi, ou déjà `submitted`.

Laisser l'utilisateur cliquer alors que le formulaire est invalide est aussi un
choix valable : `submit()` touche alors tous les champs, ce qui affiche toutes
les erreurs d'un coup.

:::note `submitting` couvre la porte, pas votre requête
Le formulaire n'est `submitting` que pendant l'exécution de `submit()`. Une fois
la promesse résolue, il est `submitted` — y compris pendant que votre propre
`fetch` est encore en cours. Si cette requête est lente et ne doit pas partir
deux fois, suivez-la vous-même.
:::

## En React {#in-react}

`useForm()` donne les mêmes `submit`, `reset` et flags :

```tsx
import { hooksFor } from "slz-react-form";

export const { useField, useForm } = hooksFor(signupForm);

function SubmitButton() {
    const { hasFlag, submit, reset } = useForm();

    const send = async () => {
        if (!(await submit())) {
            return;
        }
        await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
        reset();
    };

    return (
        <button type="button" disabled={hasFlag("submitting")} onClick={() => void send()}>
            {hasFlag("submitting") ? "Sending…" : "Sign up"}
        </button>
    );
}
```

Lisez les valeurs sur le formulaire une fois `submit()` résolu —
`signupForm.values()` — plutôt que dans une valeur capturée pendant le rendu :
un lookup a pu écrire une valeur pendant la soumission.

## Les erreurs renvoyées par le serveur

La porte s'est ouverte, vous avez envoyé, et le serveur répond que l'email est
déjà pris. Placez un
[`ExternalValidator`](validate.md#several-validators-on-one-field) à côté des
règles du champ ([`EmailValidator`](validate.md#a-rule) est la règle de la page
Valider) et donnez-lui les constats du serveur. Montez le champ : un champ non
monté n'est ni jugé ni envoyé, et rien ne vous prévient.

```ts
import { ExternalValidator } from "slz-form";

const emailTaken = new ExternalValidator<string>();

const email = signupForm.field("email", { required: true, validator: [new EmailValidator(), emailTaken] });
email.mount();

async function save(): Promise<void> {
    if (!(await signupForm.submit())) {
        return;
    }
    const response = await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
    if (response.status === 422) {
        emailTaken.set([{ message: "This email is already registered", severity: "error", code: "taken" }]);
        return;
    }
    signupForm.reset();
}
```

En React, c'est `useField` qui crée le champ, et seul le **premier** appel qui
crée un champ lit ses paramètres. Donnez donc l'`ExternalValidator` à `useField`
lui-même, et gardez l'instance au niveau du module pour que `save()` puisse
l'atteindre :

```tsx
const emailTaken = new ExternalValidator<string>();

function EmailField() {
    const field = useField({ name: "email", required: true, validator: [new EmailValidator(), emailTaken] });
    return <input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />;
}
```

Le champ affiche l'erreur aussitôt, le formulaire passe à `error`, et le constat
disparaît dès que l'utilisateur modifie l'email. Le formulaire est encore
`submitted` à ce moment-là : gardez donc le bouton avec `hasFlag("submitting")`,
pas avec `hasFlag("valid", "idle")`.

## Repartir de zéro : `form.reset()`

`form.reset()` remet chaque champ à son `initialValue` (ou à vide), non touché
et `pristine`, rejoue les hooks `onMount` de chaque champ (un prefill refait
donc son appel), retire toutes les lignes de toutes les listes, vide
`form.engineErrors` et ramène le statut à `idle`.

## Réglages {#settings}

```ts
new FormController<SignupFields>({ name: "signup", settleTimeout: 5_000 });
```

`settleTimeout` est la durée pendant laquelle `submit()` attend le travail en
cours, en millisecondes. Les lignes d'une liste utilisent le `settleTimeout` de
leur formulaire parent.

:::caution Une règle qui ne se termine jamais peut bloquer `submit()`
`settleTimeout` borne la première validation et l'attente, mais pas la seconde
validation d'une valeur qui a changé pendant l'attente. Si la promesse d'une
règle ne se termine jamais à ce moment-là, `submit()` ne rend jamais la main, et le
formulaire reste `submitting` avec ses champs verrouillés — `reset()` ne les
déverrouille pas. Donnez un délai maximal à chaque appel réseau d'un validator,
par exemple `fetch(url, { signal: AbortSignal.timeout(5_000) })`.
:::
