import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CodeBlock from "@theme/CodeBlock";
import Layout from "@theme/Layout";
import type { ReactNode } from "react";

import styles from "./index.module.css";

/**
 * L'accueil.
 *
 * Elle montre le code avant de le décrire : ce qui distingue ce moteur se voit
 * dans quatre lignes de vue, pas dans une liste d'arguments.
 */
const VIEW = `if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}`;

const ARGUMENTS: readonly { title: string; body: ReactNode }[] = [
    {
        title: "Les états impossibles ne sont pas représentables",
        body: (
            <>
                <code>pristine</code> et <code>error</code> s'excluent, comme{" "}
                <code>idle</code> et <code>loading</code>. Une union plate les
                laisserait coexister ; deux natures de flags les en empêchent.
            </>
        ),
    },
    {
        title: "La validité a une autorité unique",
        body: (
            <>
                Seul le Validator la produit. Aucun behavior ne peut le
                contredire, donc il n'y a jamais d'arbitrage entre deux sources
                qui ne sont pas d'accord.
            </>
        ),
    },
    {
        title: "Un champ qui change ne re-rend pas les autres",
        body: (
            <>
                Chaque champ a son abonnement et un snapshot stable par
                référence. S'abonner au formulaire entier est un choix
                explicite, pas le défaut.
            </>
        ),
    },
    {
        title: "Rien de faux ne compile",
        body: (
            <>
                Le formulaire déclare ce que vaut chaque champ ; behaviors et
                hooks en dérivent. Un nom fautif ou un mauvais type est une
                erreur de compilation — et aucun <code>as</code> côté
                consommateur.
            </>
        ),
    },
];

export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();

    return (
        <Layout title="Un moteur de formulaires piloté par des flags" description={siteConfig.tagline}>
            <header className={styles.hero}>
                <div className="container">
                    <h1 className={styles.title}>slz-form</h1>
                    <p className={styles.tagline}>{siteConfig.tagline}</p>
                    <div className={styles.actions}>
                        <Link className="button button--primary button--lg" to="/docs/demarrer/le-probleme">
                            Le problème qu'il résout
                        </Link>
                        <Link className="button button--secondary button--lg" to="/docs/demarrer/premier-formulaire">
                            Premier formulaire
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                <section className="container margin-vert--xl">
                    <div className="row">
                        <div className="col col--6">
                            <h2>Le composant ne décide de rien</h2>
                            <p>
                                Il lit et se rend. Ce qu'un champ <em>est</em> se lit en
                                flags ; ce qu'il <em>contient</em> se lit en données. Deux
                                fonctions : <code>hasFlag</code> est le ET,{" "}
                                <code>hasAny</code> le OU.
                            </p>
                            <p>
                                C'est ce qui supprime le{" "}
                                <code>disabled={"{loading || submitting || !brand}"}</code>{" "}
                                recomposé à la main dans chaque champ.
                            </p>
                        </div>
                        <div className="col col--6">
                            <CodeBlock language="tsx">{VIEW}</CodeBlock>
                        </div>
                    </div>
                </section>

                <section className="container margin-bottom--xl">
                    <div className="row">
                        {ARGUMENTS.map((argument) => (
                            <div key={argument.title} className="col col--6 margin-bottom--lg">
                                <h3>{argument.title}</h3>
                                <p>{argument.body}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="container margin-bottom--xl">
                    <div className={styles.note}>
                        <strong>Pré-publication.</strong> Les packages sont construits et
                        prêts, rien n'est encore sur npm, et l'API peut encore bouger.
                    </div>
                </section>
            </main>
        </Layout>
    );
}
