import { describe, expect, it } from "vitest";
import { FormController, type BehaviorContext, type BehaviorResult, type IBehavior } from "../src/index";
import { until, wait } from "./helpers";

/**
 * Le filet du chantier « le repos publié suit le travail en vol ».
 *
 * Il n'inspecte **aucun champ privé** : la comptabilité interne des passes a
 * déjà été refondue une dizaine de fois, et un test qui s'y accroche casse à
 * chaque refonte sans rien prouver. Il vérifie ce qu'un consommateur observe,
 * et rien d'autre :
 *
 * - **O1 — soumis avant convergence.** Une des formes écrit une valeur depuis
 *   un rappel différé, après avoir déclaré l'attente. Si elle est en jeu, le
 *   payload au moment de la soumission doit porter **sa** valeur. C'est
 *   l'oracle qui manquait aux douze tours précédents ; aucun invariant de passe
 *   ne l'attrape, parce que la comptabilité peut être parfaite pendant que
 *   l'activité **publiée** ment.
 *
 *   Comparer le payload avant et après serait trop large : une forme qui écrit
 *   sa valeur redéclenche `onChange`, et ce que cette nouvelle passe fait
 *   ensuite est son droit.
 * - **O2 — attente fuitée.** Une fois tout retombé, le champ reste `loading`,
 *   ou se déclare occupé.
 *
 * Le générateur croise des formes de hooks connues pour se marcher dessus. La
 * matrice est fixe : pas de tirage au sort, pour que l'échec soit reproductible.
 */

const HUNG = 10_000;

type Shape = { readonly name: string; readonly run: (ctx: BehaviorContext<string>) => BehaviorResult };

const SHAPES: readonly Shape[] = [
    { name: "sync-neutre", run: (ctx) => ctx.state },
    // Travail détaché : elle allume l'attente et rien ne retombera pour elle.
    { name: "sync-attente-détachée", run: (ctx) => { void wait(HUNG); return ctx.state.loading(); } },
    // Elle masque, puis pend : le masquage est un fait d'une passe **vivante**.
    {
        name: "masque-puis-pend",
        run: async (ctx) => { await wait(10); ctx.push(ctx.state.hide()); await wait(HUNG); },
    },
    {
        name: "attente-puis-rejet",
        run: async (ctx) => { await wait(5); ctx.push(ctx.state.loading()); await wait(15); throw new Error("HS"); },
    },
    {
        name: "attente-puis-repos",
        run: async (ctx) => { ctx.push(ctx.state.loading()); await wait(15); return ctx.state.idle(); },
    },
    // Elle rend la main tout de suite et écrit plus tard, depuis un rappel.
    // C'est la seule qui écrit une valeur : l'oracle O1 s'appuie sur elle.
    {
        name: "écriture-tardive",
        run: (ctx) => {
            setTimeout(() => {
                ctx.setValue("valeur-du-serveur");
                ctx.push(ctx.state.idle().unlock().show());
            }, 45);
            return ctx.state.loading().lock();
        },
    },
    // Elle attend longtemps sans jamais rien afficher.
    { name: "discrète", run: async () => { await wait(35); } },
];

interface Report {
    readonly pair: string;
    readonly rule: string;
    readonly detail: string;
}

async function play(onChange: Shape, onBlur: Shape): Promise<Report[]> {
    const pair = `${onChange.name} / ${onBlur.name}`;
    const reports: Report[] = [];
    const form = new FormController<{ a: string; b: string }>({
        name: `inv-${pair}`,
        settleTimeout: 60,
    });
    const behavior: IBehavior<string> = {
        onChange: (ctx) => onChange.run(ctx),
        onBlur: (ctx) => onBlur.run(ctx),
    };
    const a = form.field("a", { required: true, behaviors: [behavior] });
    const b = form.field("b", { initialValue: "b" });
    a.mount();
    b.mount();
    form.mount();
    await wait(10);

    a.change("saisie");
    a.blur();
    await wait(25);

    const submitted = await form.submit();
    const atSubmit = form.getSnapshot().values;

    const awaited = onChange.name === "écriture-tardive" || onBlur.name === "écriture-tardive";
    if (submitted && awaited && atSubmit.a !== "valeur-du-serveur") {
        reports.push({
            pair,
            rule: "O1 soumis avant convergence",
            detail: `payload à la soumission ${JSON.stringify(atSubmit)}`,
        });
    }

    // Tout retomber : les formes qui pendent sont libérées par la convergence.
    await wait(160);
    if (a.snapshot.hasFlag("loading") || a.isBusy) {
        reports.push({
            pair,
            rule: "O2 attente fuitée",
            detail: `flags=${JSON.stringify(a.snapshot.flags)} isBusy=${String(a.isBusy)}`,
        });
    }
    return reports;
}

describe("l'activité publiée suit le travail en vol", () => {
    it("aucune paire de hooks ne soumet avant convergence ni ne fuit une attente", async () => {
        const found: Report[] = [];
        for (const onChange of SHAPES) {
            for (const onBlur of SHAPES) {
                found.push(...await play(onChange, onBlur));
            }
        }
        expect(found.map((r) => `${r.pair} → ${r.rule} (${r.detail})`)).toEqual([]);
    }, 120_000);

    it("une sœur qui réussit n'éteint pas l'attente d'une autre", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "inv-s2" });
        const behavior: IBehavior<string> = {
            onChange: (ctx) => {
                setTimeout(() => {
                    ctx.setValue("valeur-du-serveur");
                    ctx.push(ctx.state.idle().unlock().show());
                }, 100);
                return ctx.state.loading().lock().hide();
            },
            onBlur: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(20);
                return ctx.state.idle();
            },
        };
        const a = form.field("a", { required: true, behaviors: [behavior] });
        const b = form.field("b", { initialValue: "b" });
        a.mount();
        b.mount();
        form.mount();
        await wait(10);

        a.change("saisie");
        a.blur();
        await wait(40);

        // `ctx.state` est la tranche fusionnée du behavior : la sœur qui
        // retourne `idle` éteignait l'attente de l'autre sans le vouloir.
        expect(a.isBusy).toBe(true);
        expect(await form.submit()).toBe(true);
        expect(form.getSnapshot().values).toEqual({ a: "valeur-du-serveur", b: "b" });
    });

    it("une sœur qui échoue ne défait pas ce qu'une passe vivante a écrit", async () => {
        const form = new FormController<{ a: string }>({ name: "inv-s1" });
        const behavior: IBehavior<string> = {
            // Elle masque **après** l'ouverture de la passe du blur : le
            // masquage n'est donc pas dans l'état d'entrée de celle-ci.
            onChange: async (ctx) => { await wait(10); ctx.push(ctx.state.hide()); await wait(HUNG); },
            onBlur: async (ctx) => { await wait(5); ctx.push(ctx.state.loading()); await wait(15); throw new Error("HS"); },
        };
        const field = form.field("a", { required: true, behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(10);

        field.change("secret");
        field.blur();
        await until(() => field.snapshot.hasFlag("invisible"));
        await wait(60);

        // La passe vivante tient toujours le champ masqué : personne d'autre
        // n'a le droit de le rendre au payload.
        expect(field.snapshot.hasFlag("invisible")).toBe(true);
        expect(form.getSnapshot().values).toEqual({});
    });
});
