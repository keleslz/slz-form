# Traductions du site

L'**anglais est la langue source** : il s'écrit dans `website/docs` et dans
`src/pages`, et il est servi à la racine du site. Chaque autre langue est un
dossier ici, `i18n/<locale>/`, servi sous `/<locale>/`, qui ne contient que des
traductions — jamais de contenu qui n'existerait pas en anglais.

Une page sans traduction **retombe sur l'anglais** : une langue peut donc être
ajoutée à moitié et complétée au fil de l'eau.

Deux contenus échappent à la règle, et restent **en français dans toutes les
langues** : la référence d'API, générée depuis les commentaires du code, et le
dossier de conception (`docs/MODEL.md`), lu en place.

## Ajouter une langue

Avec `es` pour exemple.

1. La déclarer dans `docusaurus.config.ts` :

    ```ts
    i18n: {
        defaultLocale: "en",
        locales: ["en", "fr", "es"],
        localeConfigs: {
            // …
            es: { label: "Español" },
        },
    },
    ```

    Le sélecteur de langue de la barre de navigation la propose aussitôt.

2. Générer les fichiers de l'interface :

    ```bash
    npm run write-translations -- --locale es
    ```

    Il écrit `i18n/es/code.json` (la page d'accueil), `docusaurus-theme-classic/`
    (barre de navigation, pied de page) et
    `docusaurus-plugin-content-docs/current.json` (catégories de la barre
    latérale), préremplis en anglais : il reste à traduire les `message`.

3. Traduire les pages, **au même chemin et sous le même nom de fichier** que
   leur source :

    ```
    docs/guides/validate.md
    → i18n/es/docusaurus-plugin-content-docs/current/guides/validate.md
    ```

    Dans le frontmatter, `id` et `sidebar_position` ne bougent pas ; seuls
    `title` et `description` se traduisent.

4. Vérifier : `npm run build` construit toutes les langues et échoue sur un lien
   ou une ancre morte. Pour n'en regarder qu'une : `npm run start -- --locale es`.

## Modifier une page

On modifie l'anglais, puis sa traduction dans chaque `i18n/<locale>/`. Rien ne
le vérifie : une traduction oubliée reste simplement en retard sur sa source.
