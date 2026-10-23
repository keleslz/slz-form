---
id: a-row-is-a-form
title: Une ligne est un formulaire
sidebar_position: 4
description: Pourquoi les champs répétables n'ont pas de nommage par chemins, et ce que cela implique pour ajouter, déplacer ou valider des lignes.
---

# Une ligne est un formulaire

Une liste répétable — lignes de facture, contacts, parts — n'a **aucun** nom par
chemin : ni `lines[0].qty`, ni `lines.0.qty`. Chaque **ligne** est un petit
`FormController` à part entière, avec la même API, la même validation et les
mêmes behaviors que n'importe quel formulaire.

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const id = lines.append();          // a stable id, never an index
const row = lines.row(id);          // null if that row was removed
if (row) {
    const qty = row.field("qty");
    qty.mount();
    qty.change(3);
}

lines.remove(id);
```

Les champs d'une ligne se créent et se montent comme n'importe quel champ :
`row.field(name)`, puis `mount()`. En React, `useFieldOn(row.form, …)` fait les
deux — voir [Listes répétables](../react/lists.md).

## Ce que ça évite

Les lignes sont **identifiées**, jamais indexées. Retirer ou déplacer une ligne
ne renomme rien, donc aucun `watch` ne se met à pointer vers une autre ligne.

Avec des noms indexés, supprimer la ligne 0 fait de l'ancienne ligne 1 la
nouvelle ligne 0 : une dépendance déclarée sur `lines[1].qty` observe en silence
une autre ligne. Le bug ne se voit pas à la lecture du code et se reproduit
mal.

## Ce que ça coûte

- Les champs de chaque ligne doivent être créés et montés — par votre code
  (`row.field(name)`, puis `mount()`), ou par `useFieldOn` en React.
- Une ligne se monte et se démonte comme un formulaire. Une ligne dont les
  champs n'ont jamais été montés apporte `{}` au payload et ne bloque rien.
- Une ligne ne peut pas lire son formulaire parent : dans une ligne, `ctx.form`
  est la ligne, et `watch` ne voit que les champs de la ligne.
- `form.reset()` vide la liste — une liste commence vide.

En échange, rien dans le moteur n'a été retravaillé pour les listes : la map de
champs, le graphe de dépendances et la validation sont ceux qu'utilisent déjà
les formulaires.

## Une règle qui porte sur toute la liste

« Les parts font 100 au total » n'appartient à aucune ligne. C'est un validator
posé sur un champ du formulaire **parent**, qui déclare la liste dans `watch` et
la lit avec `ctx.watched(...)`. L'exemple complet est dans
[Champs répétables](../guides/repeatable-fields.md#a-rule-about-the-whole-list).

Une liste dit son état avec les mots d'un formulaire : `valid` ou `error` —
jamais `pristine`. Une liste est un agrégat, pas un champ que l'utilisateur
touche : une ligne dont un champ obligatoire est vide met donc la liste en
`error` avant que quiconque n'ait tapé.
