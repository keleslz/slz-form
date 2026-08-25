import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

/**
 * Options communes aux deux instances de `docusaurus-plugin-typedoc`.
 *
 * La référence est **générée** : les tableaux d'API écrits à la main mentaient
 * dès la première signature qui bougeait. Les deux `index.ts` sont des surfaces
 * explicites — pas d'`export *` —, donc ce qui sort ici est exactement le
 * contrat public, sans les rouages.
 */
const typedocCommon = {
    // `AnyForm` est le pont générique interne des hooks : il apparaît dans les
    // signatures publiques sans être exporté, et TypeDoc s'en plaint. Le dire
    // ici vaut mieux que d'élargir la surface publique pour faire taire un
    // avertissement.
    intentionallyNotExported: ["AnyForm"],
    // Le README d'un package est désormais un pitch : le répéter en tête de la
    // référence n'apprendrait rien.
    readme: "none",
    // Les commentaires du moteur sont en français et souvent longs : sans ça,
    // TypeDoc n'affiche que la première phrase.
    hidePageHeader: true,
    useCodeBlocks: true,
    expandObjects: true,
    parametersFormat: "table",
    sidebar: { autoConfiguration: true, pretty: true },
    // Les titres générés sont préfixés du genre — « Class: BehaviorState ».
    // Dans une barre latérale française, le préfixe n'apprend rien que le nom
    // ne dise déjà, et il décale la lecture d'une colonne.
    textContentMappings: {
        "title.memberPage": "{name}",
    },
};

const config: Config = {
    title: "slz-form",
    tagline: "Un moteur de formulaires piloté par des flags, indépendant du framework",
    favicon: "img/favicon.svg",

    url: "https://keleslz.github.io",
    baseUrl: "/slz-form-event/",
    organizationName: "keleslz",
    projectName: "slz-form-event",
    trailingSlash: false,

    // Le build **est** le vérificateur de liens : une ancre morte casse la CI
    // au lieu de partir en production.
    onBrokenLinks: "throw",
    onBrokenAnchors: "throw",
    markdown: {
        hooks: {
            onBrokenMarkdownLinks: "throw",
        },
    },

    // Tout le contenu est en français ; l'interface doit suivre, sinon on lit
    // « Next » et « Previous » sous des pages qui disent « Démarrer ».
    i18n: {
        defaultLocale: "fr",
        locales: ["fr"],
    },

    presets: [
        [
            "classic",
            {
                docs: {
                    path: "docs",
                    routeBasePath: "docs",
                    sidebarPath: "./sidebars.ts",
                    editUrl: "https://github.com/keleslz/slz-form-event/tree/master/website/",
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    plugins: [
        // `docs/MODEL.md` reste où il est : neuf endroits le désignent par ce
        // chemin, dont la règle dure 8 du skill de conception, et le code cite
        // ses invariants par numéro. Le site le lit **en place** — une source,
        // pas une copie.
        [
            "@docusaurus/plugin-content-docs",
            {
                id: "conception",
                path: "../docs",
                routeBasePath: "conception",
                sidebarPath: "./sidebars.conception.ts",
                editUrl: "https://github.com/keleslz/slz-form-event/tree/master/",
            },
        ],
        [
            "docusaurus-plugin-typedoc",
            {
                ...typedocCommon,
                id: "slz-form",
                entryPoints: ["../packages/form/src/index.ts"],
                tsconfig: "../packages/form/tsconfig.json",
                out: "docs/reference/slz-form",
            },
        ],
        [
            "docusaurus-plugin-typedoc",
            {
                ...typedocCommon,
                id: "slz-react-form",
                entryPoints: ["../packages/react-form/src/index.ts"],
                tsconfig: "../packages/react-form/tsconfig.json",
                out: "docs/reference/slz-react-form",
            },
        ],
    ],

    themeConfig: {
        navbar: {
            title: "slz-form",
            logo: { alt: "slz-form", src: "img/logo.svg" },
            items: [
                { type: "docSidebar", sidebarId: "guide", position: "left", label: "Guide" },
                { type: "docSidebar", sidebarId: "reference", position: "left", label: "Référence" },
                {
                    to: "/conception/MODEL",
                    position: "left",
                    label: "Conception",
                },
                {
                    href: "https://github.com/keleslz/slz-form-event",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        footer: {
            style: "dark",
            links: [
                {
                    title: "Documentation",
                    items: [
                        { label: "Démarrer", to: "/docs/demarrer/le-probleme" },
                        { label: "Le modèle", to: "/docs/modele/flags" },
                        { label: "Référence API", to: "/docs/reference/slz-form" },
                    ],
                },
                {
                    title: "Le dossier de conception",
                    items: [
                        { label: "Arbitrages et invariants", to: "/conception/MODEL" },
                    ],
                },
                {
                    title: "Le dépôt",
                    items: [
                        { label: "GitHub", href: "https://github.com/keleslz/slz-form-event" },
                        {
                            label: "La démo",
                            href: "https://github.com/keleslz/slz-form-event/tree/master/examples/react",
                        },
                    ],
                },
            ],
            copyright: `slz-form — MIT. Documentation construite avec Docusaurus.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ["bash", "diff", "json"],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
