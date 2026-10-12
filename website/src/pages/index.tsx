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
                Impossible states cannot be represented
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
                    "{pristine} and {error} are mutually exclusive, like {idle} and {loading}. A flat union would let them coexist; two kinds of flags prevent it."
                }
            </Translate>
        ),
    },
    {
        key: "authority",
        title: (
            <Translate id="home.arguments.authority.title">Validity has a single authority</Translate>
        ),
        body: (
            <Translate id="home.arguments.authority.body">
                Only the Validator produces it. No behavior can contradict it, so there is never a
                tie to break between two sources that disagree.
            </Translate>
        ),
    },
    {
        key: "renders",
        title: (
            <Translate id="home.arguments.renders.title">
                A field that changes does not re-render the others
            </Translate>
        ),
        body: (
            <Translate id="home.arguments.renders.body">
                Each field has its own subscription and a referentially stable snapshot. Subscribing
                to the whole form is an explicit choice, not the default.
            </Translate>
        ),
    },
    {
        key: "types",
        title: <Translate id="home.arguments.types.title">Nothing wrong compiles</Translate>,
        body: (
            <Translate id="home.arguments.types.body" values={{ as: code("as") }}>
                {
                    "The form declares what each field holds; behaviors and hooks derive from it. A wrong name or a wrong type is a compile error — and no {as} on the consumer side."
                }
            </Translate>
        ),
    },
];

export default function Home(): ReactNode {
    const tagline = translate({
        id: "home.tagline",
        message: "A flag-driven, framework-agnostic form engine",
    });

    return (
        <Layout
            title={translate({
                id: "home.title",
                message: "A flag-driven form engine",
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
                                            <Translate id="home.view.reads.is">is</Translate>
                                        </em>
                                    ),
                                    holds: (
                                        <em>
                                            <Translate id="home.view.reads.holds">holds</Translate>
                                        </em>
                                    ),
                                    hasFlag: code("hasFlag"),
                                    hasAny: code("hasAny"),
                                }}
                            >
                                {
                                    "It reads and renders. What a field {is} is read as flags; what it {holds} is read as data. Two functions: {hasFlag} is AND, {hasAny} is OR."
                                }
                            </Translate>
                        </p>
                        <div className={styles.actions}>
                            <Link className="button button--primary button--lg" to="/docs/getting-started/first-form">
                                <Translate id="home.actions.firstForm">First form</Translate>
                            </Link>
                            <Link className={`button button--lg ${styles.ghost}`} to="/docs/getting-started/the-problem">
                                <Translate id="home.actions.problem">The problem it solves</Translate>
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
                        <Translate id="home.view.title">The component decides nothing</Translate>
                    </h2>
                    <p>
                        <Translate
                            id="home.view.removes"
                            values={{ disabled: code("disabled={loading || submitting || !brand}") }}
                        >
                            {"That is what removes the {disabled} recomposed by hand in every field."}
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
                        The packages are built and ready, nothing is on npm yet, and the API may still
                        change.
                    </Translate>
                </p>
            </main>
        </Layout>
    );
}
