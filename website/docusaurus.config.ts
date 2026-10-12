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
    // Dans la barre latérale, le préfixe n'apprend rien que le nom ne dise
    // déjà, et il décale la lecture d'une colonne.
    textContentMappings: {
        "title.memberPage": "{name}",
    },
};

const config: Config = {
    title: "slz-form",
    tagline: "A flag-driven, framework-agnostic form engine",
    favicon: "img/favicon.svg",

    url: "https://keleslz.github.io",
    baseUrl: "/slz-form/",
    organizationName: "keleslz",
    projectName: "slz-form",
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

    // L'anglais est la langue source : c'est lui qu'on écrit, dans `docs` et
    // `src/pages`, et il est servi à la racine. Le français en est la
    // traduction, sous `i18n/fr`, servi sous `/fr/`. Une page sans traduction
    // retombe sur l'anglais. Deux exceptions, en français dans toutes les
    // langues : la référence, générée depuis les commentaires du code, et le
    // dossier de conception, lu en place.
    i18n: {
        defaultLocale: "en",
        locales: ["en", "fr"],
        localeConfigs: {
            en: { label: "English" },
            fr: { label: "Français" },
        },
    },

    presets: [
        [
            "classic",
            {
                docs: {
                    path: "docs",
                    routeBasePath: "docs",
                    sidebarPath: "./sidebars.ts",
                    editUrl: "https://github.com/keleslz/slz-form/tree/master/website/",
                    // Les deux packages de la référence génèrent les mêmes
                    // catégories — « classes », « interfaces »… — dans la même
                    // barre latérale. Leur clé de traduction est dérivée du
                    // libellé : sans la préfixer du dossier, elles se
                    // télescopent dès qu'une seconde locale existe.
                    sidebarItemsGenerator: async ({ defaultSidebarItemsGenerator, ...args }) => {
                        const items = await defaultSidebarItemsGenerator(args);
                        return items.map((item) =>
                            item.type === "category"
                                ? { ...item, key: `${args.item.dirName}/${item.label}` }
                                : item,
                        );
                    },
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    // La recherche est **locale** : l'index est construit avec le site et
    // servi avec lui, une fois par langue. Aucun service tiers à ouvrir ni à
    // maintenir, et elle marche avant même que le site soit en ligne. Elle
    // n'existe que dans un build — pas sous `docusaurus start`.
    themes: [
        [
            "@easyops-cn/docusaurus-search-local",
            {
                hashed: true,
                language: ["en", "fr"],
                indexBlog: false,
                // Le guide, la référence, et le dossier de conception.
                docsRouteBasePath: ["docs", "conception"],
                docsDir: ["docs", "../docs"],
                searchResultLimits: 10,
                highlightSearchTermsOnTargetPage: true,
                explicitSearchResultPath: true,
            },
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
                editUrl: "https://github.com/keleslz/slz-form/tree/master/",
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
        colorMode: { respectPrefersColorScheme: true },
        navbar: {
            title: "slz-form",
            logo: { alt: "slz-form", src: "img/logo.svg" },
            items: [
                { type: "docSidebar", sidebarId: "guide", position: "left", label: "Guide" },
                { type: "docSidebar", sidebarId: "reference", position: "left", label: "Reference" },
                {
                    to: "/conception/MODEL",
                    position: "left",
                    label: "Design",
                },
                { type: "localeDropdown", position: "right" },
                {
                    href: "https://github.com/keleslz/slz-form",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        footer: {
            links: [
                {
                    title: "Documentation",
                    items: [
                        { label: "Getting started", to: "/docs/getting-started/the-problem" },
                        { label: "The model", to: "/docs/model/flags" },
                        { label: "API reference", to: "/docs/reference/slz-form" },
                    ],
                },
                {
                    title: "Design notes",
                    items: [
                        { label: "Trade-offs and invariants", to: "/conception/MODEL" },
                    ],
                },
                {
                    title: "Repository",
                    items: [
                        { label: "GitHub", href: "https://github.com/keleslz/slz-form" },
                        {
                            label: "The demo",
                            href: "https://github.com/keleslz/slz-form/tree/master/examples/react",
                        },
                    ],
                },
            ],
            copyright: `slz-form — MIT. Documentation built with Docusaurus.`,
        },
        prism: {
            // Le code est sur fond sombre dans les deux modes : un seul thème.
            theme: prismThemes.nightOwl,
            darkTheme: prismThemes.nightOwl,
            additionalLanguages: ["bash", "diff", "json"],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
