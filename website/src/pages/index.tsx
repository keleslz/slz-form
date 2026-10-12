import Link from "@docusaurus/Link";
import Translate, { translate } from "@docusaurus/Translate";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import type { ReactNode } from "react";

import styles from "./index.module.css";

/**
 * L'accueil.
 *
 * Elle montre le code avant de le décrire : ce qui distingue ce moteur se voit
 * dans quatre lignes de vue, pas dans une liste d'arguments.
 *
 * L'anglais est écrit ici, en place ; le français vit dans `i18n/fr/code.json`,
 * sous les mêmes `id`. Les balises passent par `values` : une traduction
 * déplace les mots, pas le balisage.
 */
const VIEW = `if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}`;

/** Les flags que lit la vue ci-dessus, affichés comme la démo les affiche. */
const FLAGS = ["locked", "loading", "error"] as const;

const code = (text: string): ReactNode => <code>{text}</code>;

const ARGUMENTS: readonly { key: string; title: ReactNode; body: ReactNode }[] = [
    {
        key: "impossible",
        title: (
            <Translate id="home.arguments.impossible.title">
                Field flags stay consistent
            </Translate>
        ),
        body: (
            <Translate
                id="home.arguments.impossible.body"
                values={{
                    pristine: code("pristine"),
                    error: code("error"),
                    idle: code("idle"),
                    loading: code("loading"),
                }}
            >
                {
                    "A field has one displayed validity state, such as {pristine} or {error}, and one activity state, {idle} or {loading}. Locks and other flags can be combined."
                }
            </Translate>
        ),
    },
    {
        key: "authority",
        title: (
            <Translate id="home.arguments.authority.title">Validators check your values</Translate>
        ),
        body: (
            <Translate id="home.arguments.authority.body">
                A validator checks a value and reports errors or warnings. A behavior reacts to field
                events, for example by fetching model options when the car brand changes.
            </Translate>
        ),
    },
    {
        key: "renders",
        title: (
            <Translate id="home.arguments.renders.title">
                Each field has its own subscription
            </Translate>
        ),
        body: (
            <Translate id="home.arguments.renders.body">
                Each field reads a snapshot of its current state. Unrelated fields do not notify that
                subscription. Dependencies and React parent renders can still update other components.
            </Translate>
        ),
    },
    {
        key: "types",
        title: <Translate id="home.arguments.types.title">TypeScript checks field names and values</Translate>,
        body: (
            <Translate id="home.arguments.types.body" values={{ as: code("as") }}>
                {
                    "Declare each field name and value type once. The derived helpers check names and values, so ordinary use does not need {as} casts."
                }
            </Translate>
        ),
    },
];

export default function Home(): ReactNode {
    const tagline = translate({
        id: "home.tagline",
        message: "Manage form state in any UI framework",
    });

    return (
        <Layout
            title={translate({
                id: "home.title",
                message: "Form values, validation and loading state",
            })}
            description={tagline}
        >
            <header className={styles.hero}>
                <div className={`container ${styles.heroGrid}`}>
                    <div>
                        <p className={styles.eyebrow}>slz-form</p>
                        <h1 className={styles.title}>{tagline}</h1>
                        <p className={styles.lead}>
                            <Translate
                                id="home.view.reads"
                                values={{
                                    is: (
                                        <em>
                                            <Translate id="home.view.reads.is">state</Translate>
                                        </em>
                                    ),
                                    holds: (
                                        <em>
                                            <Translate id="home.view.reads.holds">value</Translate>
                                        </em>
                                    ),
                                    hasFlag: code("hasFlag"),
                                    hasAny: code("hasAny"),
                                }}
                            >
                                {
                                    "Read a field’s {is} through named flags such as loading or locked, and read its {holds} separately. {hasFlag} checks all supplied flags; {hasAny} checks at least one. Use them to render inputs and messages."
                                }
                            </Translate>
                        </p>
                        <div className={styles.actions}>
                            <Link className="button button--primary button--lg" to="/docs/getting-started/first-form">
                                <Translate id="home.actions.firstForm">Build your first form</Translate>
                            </Link>
                            <Link className={`button button--lg ${styles.ghost}`} to="/docs/getting-started/the-problem">
                                <Translate id="home.actions.problem">See a dependent select</Translate>
                            </Link>
                        </div>
                    </div>

                    <div className={styles.window}>
                        <div className={styles.windowBar}>
                            <span className={styles.windowName}>Field.tsx</span>
                            <span className={styles.flags}>
                                {FLAGS.map((flag) => (
                                    <span key={flag} className={`${styles.flag} ${styles[`flag_${flag}`]}`}>
                                        {flag}
                                    </span>
                                ))}
                            </span>
                        </div>
                        <CodeBlock language="tsx">{VIEW}</CodeBlock>
                    </div>
                </div>
            </header>

            <main className={`container ${styles.main}`}>
                <section className={styles.statement}>
                    <h2>
                        <Translate id="home.view.title">Keep field rules on the controller</Translate>
                    </h2>
                    <p>
                        <Translate
                            id="home.view.removes"
                            values={{ disabled: code("disabled={loading || submitting || !brand}") }}
                        >
                            {"For a car model select, configure when to load options and lock the input. The controller combines those rules so your component can read a flag instead of repeating {disabled}."}
                        </Translate>
                    </p>
                </section>

                <section className={styles.cards}>
                    {ARGUMENTS.map((argument, index) => (
                        <article key={argument.key} className={styles.card}>
                            <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
                            <h3>{argument.title}</h3>
                            <p>{argument.body}</p>
                        </article>
                    ))}
                </section>

                <p className={styles.note}>
                    <span className={styles.noteLabel}>
                        <Translate id="home.note.label">Pre-release.</Translate>
                    </span>{" "}
                    <Translate id="home.note.body">
                        The API may still change. Follow the repository setup in the documentation to try
                        the packages and the React demo during development.
                    </Translate>
                </p>
            </main>
        </Layout>
    );
}
