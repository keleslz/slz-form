import { describe, expect, it } from "vitest";
import {
    ACTIVITY_FLAGS,
    DebouncedValidator,
    ExternalValidator,
    BEHAVIOR_FLAGS,
    BehaviorState,
    FormController,
    FormSnapshot,
    isReservedFlag,
    MARKER_FLAGS,
    UiState,
    VALIDITY_FLAGS,
    IValidator,
    prefill,
    type FieldArray,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

/**
 * La surface de lecture, ce sont **deux fonctions et des flags**.
 *
 * Ce fichier tient la règle : `hasFlag` est le ET, `hasAny` le OU, le
 * vocabulaire est le même au champ et au formulaire, et ce qui était un booléen
 * dérivé se lit désormais par un flag — sans que l'arbitrage 24 bouge.
 */

/** Refuse tout ce qui n'est pas « ok ». */
class MustBeOk extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(value !== "ok", "doit valoir ok", { code: "not-ok" });
    }
}

describe("les deux fonctions", () => {
    it("hasFlag est un ET, hasAny un OU", async () => {
        const form = new FormController<{ a: string }>({ name: "f1" });
        const locking: IBehavior<string> = { onMount: (ctx) => ctx.state.lock() };
        const field = form.field("a", { behaviors: [locking] });
        field.mount();
        form.mount();
        await wait(10);

        // `locked` est là, `loading` non : le ET échoue, le OU passe.
        expect(field.snapshot.hasFlag("locked")).toBe(true);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
        expect(field.snapshot.hasFlag("locked", "loading")).toBe(false);
        expect(field.snapshot.hasAny("locked", "loading")).toBe(true);
        expect(field.snapshot.hasAny("loading", "invisible")).toBe(false);
    });

    it("sans argument, le ET est vrai et le OU est faux", () => {
        const form = new FormController<{ a: string }>({ name: "f1-vide" });
        const field = form.field("a", {});

        // Les neutres de chaque opération. Sans ça, un `hasFlag(...list)` sur une
        // liste vide se comporterait au hasard chez l'appelant.
        expect(field.snapshot.hasFlag()).toBe(true);
        expect(field.snapshot.hasAny()).toBe(false);
    });

    it("le formulaire répond aux mêmes deux fonctions", async () => {
        const form = new FormController<{ a: string }>({ name: "f2" });
        const field = form.field("a", { required: true });
        field.mount();
        form.mount();
        await wait(10);

        expect(form.getSnapshot().hasFlag("error", "idle")).toBe(true);
        expect(form.getSnapshot().hasAny("valid", "submitting")).toBe(false);

        field.change("rempli");
        await wait(20);
        expect(form.getSnapshot().hasFlag("valid", "idle")).toBe(true);
    });
});

describe("hasFlag(\"error\") remplace showError", () => {
    it("le champ touché et refusé allume error", async () => {
        const form = new FormController<{ a: string }>({ name: "f3" });
        const field = form.field("a", { validator: new MustBeOk() });
        field.mount();
        form.mount();
        field.change("non");
        await wait(20);

        expect(field.snapshot.hasFlag("error")).toBe(true);
        expect(field.snapshot.hasFlag("touched")).toBe(true);
    });

    it("le champ non touché ne l'allume pas, même refusé", async () => {
        const form = new FormController<{ a: string }>({ name: "f4" });
        const field = form.field("a", { initialValue: "non", validator: new MustBeOk() });
        field.mount();
        form.mount();
        await wait(20);

        // L'ancien `showError` était `validity === "error" && touched`. La
        // conjonction était morte : `resolveValidity` rend `pristine` tant qu'on
        // n'a pas touché, donc le flag `error` implique déjà `touched`.
        expect(field.snapshot.hasFlag("touched")).toBe(false);
        expect(field.snapshot.hasFlag("error")).toBe(false);
        expect(field.snapshot.hasFlag("pristine")).toBe(true);
        // Le verdict, lui, existe bel et bien.
        expect(field.snapshot.errors).toEqual(["doit valoir ok"]);
    });
});

describe("arbitrage 24 — un prefill n'allume rien, mais compte", () => {
    it("prérempli et faux : le champ reste pristine, le formulaire est en error", async () => {
        const form = new FormController<{ a: string }>({ name: "f5" });
        const field = form.field("a", {
            validator: new MustBeOk(),
            behaviors: [prefill<string>(async () => "cassé")],
        });
        field.mount();
        form.mount();
        await until(() => field.snapshot.value === "cassé");
        await wait(20);

        expect(field.snapshot.hasFlag("pristine")).toBe(true);
        expect(field.snapshot.hasFlag("error")).toBe(false);
        expect(form.getSnapshot().hasFlag("error")).toBe(true);
        expect(await form.submit()).toBe(false);
    });

    it("prérempli et correct : soumettable sans la moindre interaction", async () => {
        const form = new FormController<{ a: string }>({ name: "f6" });
        const field = form.field("a", {
            validator: new MustBeOk(),
            behaviors: [prefill<string>(async () => "ok")],
        });
        field.mount();
        form.mount();
        await until(() => field.snapshot.value === "ok");
        await wait(20);

        expect(field.snapshot.hasFlag("pristine")).toBe(true);
        expect(form.getSnapshot().hasFlag("valid", "idle")).toBe(true);
        expect(await form.submit()).toBe(true);
    });
});

describe("les flags d'interaction et d'obligation", () => {
    it("focused va et vient, touched reste", async () => {
        const form = new FormController<{ a: string }>({ name: "f7" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        await wait(10);

        expect(field.snapshot.hasAny("touched", "focused")).toBe(false);

        field.focus();
        expect(field.snapshot.hasFlag("focused")).toBe(true);
        expect(field.snapshot.hasFlag("touched")).toBe(false);

        field.blur();
        await wait(20);
        // Le passage marque touché (arbitrage 15) et rend le focus.
        expect(field.snapshot.hasFlag("focused")).toBe(false);
        expect(field.snapshot.hasFlag("touched")).toBe(true);

        field.reset();
        await wait(20);
        expect(field.snapshot.hasAny("touched", "focused")).toBe(false);
    });

    it("required suit la déclaration, mounted la présence", async () => {
        const form = new FormController<{ a: string }>({ name: "f8" });
        const field = form.field("a", { required: true });

        expect(field.snapshot.hasFlag("mounted")).toBe(false);
        field.mount();
        form.mount();
        await wait(10);
        expect(field.snapshot.hasFlag("mounted", "required")).toBe(true);

        field.update({ required: false });
        await wait(20);
        expect(field.snapshot.hasFlag("required")).toBe(false);

        field.unmount();
        expect(field.snapshot.hasFlag("mounted")).toBe(false);
    });

    it("une écriture programmatique ne marque pas touché (arbitrage 16)", async () => {
        const form = new FormController<{ a: string }>({ name: "f9" });
        const writer: IBehavior<string> = { onMount: (ctx) => { ctx.setValue("écrit"); } };
        const field = form.field("a", { behaviors: [writer] });
        field.mount();
        form.mount();
        await wait(20);

        expect(field.snapshot.value).toBe("écrit");
        expect(field.snapshot.hasFlag("touched")).toBe(false);
    });
});

describe("les flags de l'application", () => {
    it("un behavior pose et retire son propre flag", async () => {
        const form = new FormController<{ a: string }>({ name: "f10" });
        const skeleton: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.mark("skeleton"));
                await wait(20);
                return ctx.state.unmark("skeleton");
            },
        };
        const field = form.field("a", { behaviors: [skeleton] });
        field.mount();
        form.mount();

        await until(() => field.snapshot.hasFlag("skeleton"));
        // Le moteur ne connaît pas le mot, et le transporte quand même.
        expect(field.snapshot.flags).toContain("skeleton");
        await until(() => !field.snapshot.hasFlag("skeleton"));
    });

    it("deux behaviors qui posent le même flag ne se marchent pas dessus", async () => {
        const form = new FormController<{ a: string }>({ name: "f11" });
        const mark = (delay: number): IBehavior<string> => ({
            onMount: async (ctx) => {
                ctx.push(ctx.state.mark("busy"));
                await wait(delay);
                return ctx.state.unmark("busy");
            },
        });
        const field = form.field("a", { behaviors: [mark(20), mark(80)] });
        field.mount();
        form.mount();

        await until(() => field.snapshot.hasFlag("busy"));
        await wait(45);
        // Le premier a fini, le second parle encore : l'union tient. C'est la
        // même règle que « un seul lock() verrouille ».
        expect(field.snapshot.hasFlag("busy")).toBe(true);
        await until(() => !field.snapshot.hasFlag("busy"), { timeout: 1000 });
    });
});

describe("les flags du formulaire", () => {
    it("loading remonte le travail en vol d'un champ", async () => {
        const form = new FormController<{ a: string }>({ name: "f12" });
        const slow: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(40);
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [slow] });
        field.mount();
        form.mount();

        await until(() => form.getSnapshot().hasFlag("loading"));
        await until(() => !form.getSnapshot().hasFlag("loading"), { timeout: 1000 });
    });

    it("touched remonte dès qu'un champ a été touché", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f13" });
        const a = form.field("a", {});
        const b = form.field("b", {});
        a.mount();
        b.mount();
        form.mount();
        await wait(10);

        expect(form.getSnapshot().hasFlag("touched")).toBe(false);
        b.change("x");
        await wait(20);
        expect(form.getSnapshot().hasFlag("touched")).toBe(true);
    });

    it("le statut passe par submitting puis submitted", async () => {
        const form = new FormController<{ a: string }>({ name: "f14" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        await wait(10);

        expect(form.getSnapshot().hasFlag("idle")).toBe(true);
        const pending = form.submit();
        expect(form.getSnapshot().hasFlag("submitting")).toBe(true);
        expect(await pending).toBe(true);
        expect(form.getSnapshot().hasFlag("submitted")).toBe(true);
        expect(form.getSnapshot().hasFlag("idle")).toBe(false);
    });

    it("hasFlag(\"valid\", \"idle\") est vrai exactement quand la soumission peut partir", async () => {
        const form = new FormController<{ a: string }>({ name: "f15" });
        const field = form.field("a", { required: true });
        field.mount();
        form.mount();
        await wait(10);

        // Incomplet : le ET échoue, et la soumission échoue aussi.
        expect(form.getSnapshot().hasFlag("valid", "idle")).toBe(false);
        expect(await form.submit()).toBe(false);

        // Le refus a remis le statut à `idle` — le bouton redevient cliquable
        // dès que le champ est rempli.
        field.change("rempli");
        await wait(20);
        expect(form.getSnapshot().hasFlag("valid", "idle")).toBe(true);
        expect(await form.submit()).toBe(true);
    });

    it("un champ masqué ne pèse ni sur le verdict ni sur le payload", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f16" });
        const hidden: IBehavior<string> = { onMount: (ctx) => ctx.state.hide() };
        form.field("a", { required: true, behaviors: [hidden] }).mount();
        form.field("b", { initialValue: "ok" }).mount();
        form.mount();
        await wait(20);

        expect(form.getSnapshot().hasFlag("valid")).toBe(true);
        expect(Object.keys(form.getSnapshot().values)).toEqual(["b"]);
    });
});

describe("le moteur garde ses mots", () => {
    it("mark refuse un flag du moteur au lieu de publier un état impossible", () => {
        const form = new FormController<{ a: string }>({ name: "f17" });
        const field = form.field("a", {});
        field.mount();

        // Sans la garde : `pristine` **et** `error` dans la même projection, et
        // un `loading` que rien ne peut éteindre puisque l'union ne se
        // soustrait pas.
        const state = field.snapshot.ui;
        expect(state.validity).toBe("pristine");

        const attempts = ["error", "valid", "pristine", "loading", "idle", "touched", "mounted", "submitting"];
        for (const flag of attempts) {
            expect(() => BehaviorState.neutral.mark(flag), flag).toThrow(/appartient au moteur/);
            expect(() => BehaviorState.neutral.unmark(flag), flag).toThrow(/appartient au moteur/);
        }
    });

    it("la disponibilité et les flags de l'application passent", () => {
        const base = BehaviorState.neutral;
        expect(base.mark("locked").has("locked")).toBe(true);
        expect(base.mark("skeleton").has("skeleton")).toBe(true);
        expect(base.mark("skeleton").unmark("skeleton").has("skeleton")).toBe(false);
    });

    it("un behavior qui tente le coup ne casse rien", async () => {
        const form = new FormController<{ a: string }>({ name: "f19" });
        const rogue: IBehavior<string> = { onMount: (ctx) => ctx.state.mark("error") };
        const field = form.field("a", { behaviors: [rogue] });
        field.mount();
        form.mount();
        await wait(20);

        // Le hook a levé, le moteur l'a signalé, et l'état publié reste sain.
        expect(field.snapshot.hasFlag("pristine")).toBe(true);
        expect(field.snapshot.hasFlag("error")).toBe(false);
    });
});

describe("ce qui est en vol finit toujours par être rendu", () => {
    it("recover() rend aussi les flags de l'application", async () => {
        const form = new FormController<{ a: string }>({ name: "f20" });
        const stuck: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(10_000);
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [stuck] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("skeleton"));

        field.recover();
        // Sans ça, la vue reste en squelette pour toujours : le behavior est
        // abandonné, son signal avorté, plus personne ne retirera le flag.
        expect(field.snapshot.hasFlag("skeleton")).toBe(false);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
    });

    it("un behavior qui rejette rend aussi les siens", async () => {
        const form = new FormController<{ a: string }>({ name: "f21" });
        const failing: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(10);
                throw new Error("boom");
            },
        };
        const field = form.field("a", { behaviors: [failing] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("skeleton"));
        await until(() => !field.snapshot.hasFlag("skeleton"), { timeout: 1000 });

        expect(field.snapshot.hasFlag("loading")).toBe(false);
    });
});

describe("le formulaire dit vrai sur son travail", () => {
    it("un champ masqué qui charge garde le formulaire en loading", async () => {
        const form = new FormController<{ a: string }>({ name: "f22" });
        const hiddenLoad: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.hide().loading());
                await wait(40);
                return ctx.state.hide().idle();
            },
        };
        const field = form.field("a", { behaviors: [hiddenLoad] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("loading"));

        // « Masqué vaut absent » vaut pour la validité et le payload. Le travail
        // asynchrone, lui, est bien réel — et `submit()` l'attend.
        expect(form.isBusy).toBe(true);
        expect(form.getSnapshot().hasFlag("loading")).toBe(true);
    });

    it("le champ dit `submitting` pendant que le formulaire part", async () => {
        const form = new FormController<{ a: string }>({ name: "f23" });
        const slow: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(30);
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [slow] });
        field.mount();
        form.mount();

        const pending = form.submit();
        await until(() => field.snapshot.hasFlag("submitting"));
        // Le verrou l'accompagne, sans se confondre avec lui : la vue peut
        // distinguer « le formulaire part » de « un behavior verrouille ».
        expect(field.snapshot.hasFlag("locked")).toBe(true);

        await pending;
        expect(field.snapshot.hasAny("submitting", "locked")).toBe(false);
    });

    it("une liste publie sa présence dès le montage, même vide", async () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "f24" });
        form.array("rows");
        form.mount();
        await wait(10);

        const rows = form.getSnapshot().arrays[0];
        // Sans notification au montage, le flag n'apparaissait qu'au premier
        // `append()` — une liste restée vide ne l'obtenait jamais.
        expect(rows?.ui.hasFlag("mounted")).toBe(true);

        form.unmount();
        expect(form.getSnapshot().arrays[0]?.ui.hasFlag("mounted")).toBe(false);
    });
});

describe("le focus ne survit pas au démontage", () => {
    it("un champ démonté pendant qu'il avait le focus ne le publie plus", async () => {
        const form = new FormController<{ a: string }>({ name: "f25" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        field.focus();
        expect(field.snapshot.hasFlag("focused")).toBe(true);

        field.unmount();
        await wait(10);
        expect(field.snapshot.hasAny("focused", "mounted")).toBe(false);
    });
});

describe("la garde ne casse pas ce qu'elle protège", () => {
    it("un onUnmount qui lève ne fait pas dérailler le démontage du formulaire", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f26" });
        const tidy: IBehavior<string> = {
            // Un no-op hier, une exception aujourd'hui : c'est précisément ce
            // que la garde a rendu atteignable.
            onUnmount: (ctx) => { ctx.state.unmark("touched"); },
        };
        const a = form.field("a", { behaviors: [tidy] });
        const b = form.field("b", {});
        a.mount();
        b.mount();
        form.mount();
        await wait(10);

        expect(() => form.unmount()).not.toThrow();
        // Le champ suivant est démonté lui aussi, et celui qui a levé publie
        // bien son démontage au lieu de rester en zombie.
        expect(b.isUnmounted).toBe(true);
        expect(a.snapshot.hasFlag("mounted")).toBe(false);
    });

    it("le constructeur refuse ce que mark refuse", () => {
        // Sinon la garde ne protégerait que la porte : un behavior *retourne*
        // une tranche, rien ne l'oblige à passer par les mutateurs.
        expect(() => new BehaviorState("idle", ["error"])).toThrow(/appartient au moteur/);
        expect(() => new BehaviorState("idle", ["loading"])).toThrow(/appartient au moteur/);
        expect(() => new BehaviorState("idle", ["submitting"])).toThrow(/appartient au moteur/);
        expect(() => new BehaviorState("idle", ["locked", "skeleton"])).not.toThrow();
    });

    it("la liste réservée se dérive du vocabulaire, elle ne le recopie pas", () => {
        // Un marqueur ajouté demain est réservé d'office. Sans ça, la garde
        // vieillit en silence.
        for (const flag of MARKER_FLAGS) {
            const allowed = BEHAVIOR_FLAGS.some((behaviorFlag) => behaviorFlag === flag);
            expect(isReservedFlag(flag), flag).toBe(!allowed);
        }
        for (const flag of [...VALIDITY_FLAGS, ...ACTIVITY_FLAGS]) {
            expect(isReservedFlag(flag), flag).toBe(true);
        }
        expect(isReservedFlag("skeleton")).toBe(false);
    });

    it("un mot refusé dans un behavior asynchrone est signalé, pas tu", async () => {
        const reported: string[] = [];
        const original = console.error;
        console.error = (...args: unknown[]) => { reported.push(args.map(String).join(" ")); };
        try {
            const form = new FormController<{ asyncGuard: string }>({ name: "f27" });
            const late: IBehavior<string> = {
                onMount: async (ctx) => {
                    ctx.push(ctx.state.mark("skeleton"));
                    await wait(10);
                    return ctx.state.mark("touched");
                },
            };
            const field = form.field("asyncGuard", { behaviors: [late] });
            field.mount();
            form.mount();
            await until(
                () => reported.some((line) => line.includes("asyncGuard")),
                { timeout: 1000 },
            );
        } finally {
            console.error = original;
        }
        // Le chemin synchrone rapportait déjà ; se taire ici rendait un behavior
        // asynchrone définitivement muet. On vérifie **ce** message, pas qu'il
        // se soit passé quelque chose dans la console.
        expect(reported.find((line) => line.includes("asyncGuard"))).toMatch(/appartient au moteur/);
    });
});

describe("ce qu'on rend, c'est l'attente — et elle seule", () => {
    it("un fait posé hors de l'attente survit au rejet", async () => {
        const form = new FormController<{ a: string }>({ name: "f28" });
        const composite: IBehavior<string> = {
            onMount: (ctx) => ctx.state.mark("premium"),
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(10);
                throw new Error("réseau");
            },
        };
        const field = form.field("a", { behaviors: [composite] });
        field.mount();
        form.mount();
        await wait(10);
        expect(field.snapshot.hasFlag("premium")).toBe(true);

        field.change("x");
        await until(() => field.snapshot.hasFlag("skeleton"));
        await until(() => !field.snapshot.hasFlag("skeleton"), { timeout: 1000 });

        // `neutral` effaçait aussi `premium`, que personne ne remettrait :
        // `onMount` n'est pas rejoué.
        expect(field.snapshot.hasFlag("premium")).toBe(true);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
    });

    it("recover() suit la même règle", async () => {
        const form = new FormController<{ a: string }>({ name: "f29" });
        const composite: IBehavior<string> = {
            onMount: (ctx) => ctx.state.mark("premium"),
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(10_000);
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [composite] });
        field.mount();
        form.mount();
        await wait(10);
        field.change("x");
        await until(() => field.snapshot.hasFlag("skeleton"));

        field.recover();
        expect(field.snapshot.hasFlag("skeleton")).toBe(false);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
        expect(field.snapshot.hasFlag("premium")).toBe(true);
    });
});

describe("le loading du formulaire dit ce que la soumission attend", () => {
    it("un champ démonté en vol ne le laisse pas allumé", async () => {
        const form = new FormController<{ a: string }>({ name: "f30" });
        class SlowCheck extends IValidator<string> {
            protected async validate(value: string, report: ValidationReport): Promise<void> {
                await wait(10_000);
                report.errorIf(value === "", "jamais atteint");
            }
        }
        const field = form.field("a", { initialValue: "x", validator: new SlowCheck() });
        field.mount();
        form.mount();
        await until(() => form.getSnapshot().hasFlag("loading"));

        field.unmount();
        // Le démontage abandonne le validator : sans ça le champ restait en vol
        // pour toujours, plus rien ne pouvant l'arrêter.
        expect(field.snapshot.hasFlag("loading")).toBe(false);
        // Et plus personne ne l'attend : `submit()` ne regarde que les champs
        // montés.
        expect(form.getSnapshot().hasFlag("loading")).toBe(false);
        expect(await form.submit()).toBe(true);
        expect(form.getSnapshot().hasFlag("loading")).toBe(false);
    });
});

describe("un champ monté pendant la soumission", () => {
    it("dit `submitting` comme les autres", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f31" });
        const slow: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(40);
                return ctx.state.idle();
            },
        };
        const a = form.field("a", { behaviors: [slow] });
        a.mount();
        form.mount();

        const pending = form.submit();
        await until(() => a.snapshot.hasFlag("submitting"));

        const b = form.field("b", {});
        b.mount();
        // Il n'était pas dans la liste figée à l'entrée de `submit()`, et niait
        // un fait que le formulaire affirmait.
        expect(b.snapshot.hasFlag("submitting", "locked")).toBe(true);

        await pending;
        expect(b.snapshot.hasAny("submitting", "locked")).toBe(false);
    });
});

describe("le périmètre du loading, sur l'agrégat seul", () => {
    const summary = (name: string, ui: UiState) => ({ name, value: undefined, ui, errors: [] });

    it("un champ démonté en vol ne compte pas", () => {
        const snapshot = new FormSnapshot("p", "idle", [
            summary("a", new UiState("pristine", "loading", [])),
        ]);
        // Personne ne l'attend, et rien ne viendrait éteindre son activité.
        expect(snapshot.hasFlag("loading")).toBe(false);
    });

    it("un champ monté mais masqué compte", () => {
        const snapshot = new FormSnapshot("p", "idle", [
            summary("a", new UiState("pristine", "loading", ["mounted", "invisible"])),
        ]);
        // « Masqué vaut absent » vaut pour la validité et le payload, pas pour
        // le travail en vol : la convergence l'attend.
        expect(snapshot.hasFlag("loading")).toBe(true);
    });
});

describe("rendre l'attente, c'est rendre ce qu'elle a ajouté", () => {
    it("un flag retiré juste avant l'attente reste retiré après l'échec", async () => {
        const form = new FormController<{ country: string; region: string }>({ name: "f32" });
        const conditional: IBehavior<string> = {
            watch: ["country"],
            onMount: (ctx) => ctx.state.hide(),
            onDependencyChanged: async (ctx) => {
                // Il cesse d'être invisible **avant** d'attendre : c'est une
                // décision, pas un effet de l'attente.
                ctx.push(ctx.state.show().loading().lock());
                await wait(10);
                throw new Error("réseau tombé");
            },
        };
        const country = form.field("country", {});
        const region = form.field("region", { required: true, behaviors: [conditional] });
        country.mount();
        region.mount();
        form.mount();
        await wait(20);

        country.change("FR");
        await until(() => region.snapshot.hasFlag("loading"));
        await until(() => !region.snapshot.hasFlag("loading"), { timeout: 1000 });

        // Restaurer la tranche d'avant le remettait `invisible` : le champ
        // sortait du payload, et le formulaire se déclarait valide sans lui.
        expect(region.snapshot.hasFlag("invisible")).toBe(false);
        expect(region.snapshot.hasFlag("locked")).toBe(false);
        expect(Object.keys(form.getSnapshot().values)).toContain("region");
        expect(form.getSnapshot().hasFlag("valid")).toBe(false);
        expect(await form.submit()).toBe(false);
    });

    it("ce que l'attente a ajouté part, ce qui était là reste", async () => {
        const form = new FormController<{ a: string }>({ name: "f33" });
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.mark("premium"),
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(10);
                throw new Error("boom");
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(20);

        field.change("x");
        await until(() => field.snapshot.hasFlag("skeleton"));
        await until(() => !field.snapshot.hasFlag("skeleton"), { timeout: 1000 });

        expect(field.snapshot.hasFlag("premium")).toBe(true);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
    });

    it("un rejet tardif ne défait pas ce que recover() vient de rendre", async () => {
        const form = new FormController<{ a: string }>({ name: "f34" });
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.mark("premium"),
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading().mark("skeleton"));
                await wait(40);
                throw new Error("trop tard");
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(20);
        field.change("x");
        await until(() => field.snapshot.hasFlag("skeleton"));

        field.recover();
        expect(field.snapshot.hasFlag("premium")).toBe(true);

        // La promesse retombe après coup : elle appartient à une passe
        // supplantée et ne doit plus rien trancher.
        await wait(80);
        expect(field.snapshot.hasFlag("premium")).toBe(true);
        expect(field.snapshot.hasFlag("skeleton")).toBe(false);
    });

    it("un rejet tardif ne défait pas non plus un reset()", async () => {
        const form = new FormController<{ a: string }>({ name: "f35" });
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.mark("premium"),
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(40);
                throw new Error("trop tard");
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(20);
        field.change("x");
        await until(() => field.snapshot.hasFlag("loading"));

        field.reset();
        await wait(20);
        expect(field.snapshot.hasFlag("premium")).toBe(true);

        await wait(80);
        expect(field.snapshot.hasFlag("premium")).toBe(true);
    });
});

describe("ce qui doit survivre à un démontage", () => {
    it("un onUnmount asynchrone qui rejette est rattrapé", async () => {
        const form = new FormController<{ a: string }>({ name: "f36" });
        const messy: IBehavior<string> = {
            onUnmount: async () => {
                await wait(5);
                throw new Error("nettoyage raté");
            },
        };
        const field = form.field("a", { behaviors: [messy] });
        field.mount();
        form.mount();
        await wait(10);

        const original = console.error;
        const reported: string[] = [];
        console.error = (...args: unknown[]) => { reported.push(args.map(String).join(" ")); };
        try {
            field.unmount();
            // `invoke` ne couvre que le throw synchrone : sans `catch` sur le
            // retour, ce rejet était une promesse non rattrapée, donc la fin du
            // process sous Node.
            await until(() => reported.some((line) => line.includes("nettoyage raté")), { timeout: 1000 });
        } finally {
            console.error = original;
        }
        expect(field.isUnmounted).toBe(true);
    });

    it("un champ retiré pendant la soumission est libéré lui aussi", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f37" });
        const slow: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(40);
                return ctx.state.idle();
            },
        };
        const a = form.field("a", { behaviors: [slow] });
        const b = form.field("b", {});
        a.mount();
        b.mount();
        form.mount();

        const pending = form.submit();
        await until(() => b.snapshot.hasFlag("submitting"));
        form.remove("b");

        await pending;
        // Il n'est plus dans la map : n'itérer que celle-ci le laissait
        // verrouillé pour toujours.
        expect(b.snapshot.hasAny("submitting", "locked")).toBe(false);
    });
});

describe("un validator différé reste joignable après un remontage", () => {
    it("un constat serveur arrive encore après démontage/remontage", async () => {
        const form = new FormController<{ a: string }>({ name: "f38" });
        const server = new ExternalValidator<string>();
        const field = form.field("a", {
            initialValue: "x",
            validator: new DebouncedValidator(server, 5),
        });
        field.mount();
        form.mount();
        field.change("x1");
        server.set([{ message: "déjà pris", severity: "error" }]);
        await until(() => field.snapshot.errors.includes("déjà pris"), { timeout: 1000 });

        field.unmount();
        field.mount();
        await wait(20);
        field.change("x2");
        await wait(30);
        server.set([{ message: "encore pris", severity: "error" }]);

        // `detach()` coupait l'abonnement sans jamais le rétablir : sous
        // StrictMode, tout champ monté deux fois devenait sourd aux erreurs
        // serveur.
        await until(() => field.snapshot.errors.includes("encore pris"), { timeout: 2000 });
    });
});

describe("une passe supplantée n'écrit plus rien", () => {
    it("un push qui retombe après recover() ne rallume pas loading", async () => {
        const form = new FormController<{ a: string }>({ name: "f39", settleTimeout: 80 });
        const twoPhase: IBehavior<string> = {
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading().lock());
                await wait(200);
                // Seconde phase — un retry, un lookup chaîné. Elle retombe
                // après que la convergence a expiré et appelé `recover()`.
                ctx.push(ctx.state.loading().lock());
                await wait(50);
                return ctx.state.idle().unlock();
            },
        };
        const field = form.field("a", { behaviors: [twoPhase] });
        field.mount();
        form.mount();
        await wait(20);

        field.change("x");
        await until(() => field.snapshot.hasFlag("loading"));
        await form.submit();
        await wait(400);

        // La garde ne couvrait que la sortie de la passe : `push` pouvait
        // encore allumer `loading`, et `release` — écarté par le jeton — ne
        // venait plus l'éteindre. Le champ restait occupé pour toujours, donc
        // toute soumission suivante échouait.
        expect(field.snapshot.hasFlag("loading")).toBe(false);
        expect(field.isBusy).toBe(false);
        expect(await form.submit()).toBe(true);
    });

    it("une valeur qui retombe après reset() n'est plus écrite", async () => {
        const form = new FormController<{ a: string }>({ name: "f40" });
        const slow: IBehavior<string> = {
            onChange: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(60);
                ctx.setValue("Paris");
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [slow] });
        field.mount();
        form.mount();
        await wait(20);

        field.change("75001");
        await until(() => field.snapshot.hasFlag("loading"));
        field.reset();

        await wait(120);
        // « Annuler » puis la valeur qui réapparaît toute seule.
        expect(field.snapshot.value).toBe(undefined);
    });
});

describe("rien ne fait dérailler le démontage", () => {
    it("un onUnmount qui rend un thenable sans catch", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f41" });
        const exotic: IBehavior<string> = {
            // `isPromise` ne teste que `then` : appeler `.catch` dessus levait
            // depuis `unmount()` lui-même.
            onUnmount: () => ({ then: (_: unknown, reject: (e: unknown) => void) => { reject(new Error("bim")); } }) as never,
        };
        const a = form.field("a", { behaviors: [exotic] });
        const b = form.field("b", {});
        a.mount();
        b.mount();
        form.mount();
        await wait(10);

        const original = console.error;
        console.error = () => undefined;
        try {
            expect(() => form.unmount()).not.toThrow();
        } finally {
            console.error = original;
        }
        expect(b.isUnmounted).toBe(true);
        expect(a.snapshot.hasFlag("mounted")).toBe(false);
    });
});

describe("un rejet sans attente ne rase rien", () => {
    it("un hook async qui échoue sans jamais pousser garde sa tranche", async () => {
        const form = new FormController<{ kind: string; extra: string }>({ name: "f42" });
        const audited: IBehavior<string> = {
            onMount: (ctx) => ctx.state.hide().mark("audit"),
            onChange: async () => {
                // Aucun `ctx.push` : le cas de loin le plus courant.
                await wait(10);
                throw new Error("audit indisponible");
            },
        };
        const kind = form.field("kind", {});
        const extra = form.field("extra", { required: true, behaviors: [audited] });
        kind.mount();
        extra.mount();
        form.mount();
        await wait(20);
        expect(extra.snapshot.hasFlag("invisible", "audit")).toBe(true);
        expect(form.getSnapshot().hasFlag("valid")).toBe(true);

        extra.change("x");
        await wait(60);

        // Sans attente enregistrée il n'y a rien à rendre : raser la tranche
        // faisait réapparaître un champ que le behavior avait masqué, le
        // faisait entrer dans le payload et condamnait la soumission.
        expect(extra.snapshot.hasFlag("invisible", "audit")).toBe(true);
        expect(Object.keys(form.getSnapshot().values)).not.toContain("extra");
        expect(form.getSnapshot().hasFlag("valid")).toBe(true);
    });
});

describe("rendre l'attente, référence prise avant le hook", () => {
    it("un skeleton poussé sans loading est rendu quand l'appel échoue", async () => {
        const form = new FormController<{ a: string }>({ name: "f43" });
        const profile: IBehavior<string> = {
            // Le motif de `parity.test.ts` : on marque, on n'allume pas
            // `loading`. S'indexer sur le passage à `loading` ratait ce cas.
            onMount: async (ctx) => {
                ctx.push(ctx.state.mark("skeleton"));
                await wait(15);
                throw new Error("profil indisponible");
            },
        };
        const field = form.field("a", { behaviors: [profile] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("skeleton"));
        await until(() => !field.snapshot.hasFlag("skeleton"), { timeout: 1000 });
    });

    it("un masquage pris pendant un appel sans loading est rendu, et le champ repèse", async () => {
        const form = new FormController<{ pays: string; tva: string }>({ name: "f44" });
        const check: IBehavior<string> = {
            watch: ["pays"],
            onDependencyChanged: async (ctx) => {
                ctx.push(ctx.state.hide().lock());
                await wait(15);
                throw new Error("service TVA HS");
            },
        };
        const pays = form.field("pays", {});
        const tva = form.field("tva", { required: true, behaviors: [check] });
        pays.mount();
        tva.mount();
        form.mount();
        await wait(20);

        pays.change("FR");
        await until(() => tva.snapshot.hasFlag("invisible"));
        await until(() => !tva.snapshot.hasFlag("invisible"), { timeout: 1000 });

        // Sans ça, le champ obligatoire sortait du payload et le formulaire
        // partait sans sa valeur.
        expect(tva.snapshot.hasFlag("locked")).toBe(false);
        expect(form.getSnapshot().hasFlag("valid")).toBe(false);
        expect(await form.submit()).toBe(false);
    });

    it("un hook synchrone n'écrase pas la référence d'une attente en cours", async () => {
        const form = new FormController<{ a: string }>({ name: "f45", settleTimeout: 40 });
        const hiding: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().hide());
                await wait(10_000);
                return ctx.state.idle();
            },
            // Appelé par la soumission, juste avant que la convergence n'expire.
            onSubmit: (ctx) => ctx.state,
        };
        const field = form.field("a", { initialValue: "gardée", behaviors: [hiding] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("invisible"));

        expect(await form.submit()).toBe(false);
        // La référence doit rester celle de l'attente, pas l'état masqué que
        // `onSubmit` a traversé.
        expect(field.snapshot.hasFlag("invisible")).toBe(false);
        expect(form.getSnapshot().values).toEqual({ a: "gardée" });
    });
});

describe("supplanter une passe ne rend pas muet le voisin", () => {
    it("un behavior sans rien en vol écrit encore après un recover()", async () => {
        const form = new FormController<{ slow: string; ville: string }>({
            name: "f46",
            settleTimeout: 40,
        });
        const stuck: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(10_000);
                return ctx.state.idle();
            },
        };
        const quiet: IBehavior<string> = {
            // Il n'allume jamais `loading` : la convergence ne l'attend pas, et
            // `recover()` n'a rien à lui reprendre.
            onMount: async (ctx) => {
                await wait(120);
                ctx.setValue("Paris");
            },
        };
        const slow = form.field("slow", { behaviors: [stuck] });
        const ville = form.field("ville", { behaviors: [quiet] });
        slow.mount();
        ville.mount();
        form.mount();

        // La convergence expire : `recover()` passe sur **tous** les champs
        // montés. Un compteur de champ rendait le voisin muet pour toujours.
        expect(await form.submit()).toBe(false);
        await until(() => ville.snapshot.value === "Paris", { timeout: 1000 });
    });
});

describe("les trois cas limites de la restitution", () => {
    it("une attente ouverte sans promesse est rendue aussi", async () => {
        const form = new FormController<{ a: string }>({ name: "f47", settleTimeout: 40 });
        const stuck: IBehavior<string> = {
            // Synchrone : il *retourne* `loading`, il n'attend rien. Aucune
            // entrée n'est enregistrée, et `recover()` doit malgré tout rendre
            // ce qu'il a pris — sinon le champ reste masqué et occupé à vie.
            onMount: (ctx) => ctx.state.loading().hide(),
        };
        const field = form.field("a", { initialValue: "gardée", behaviors: [stuck] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("invisible"));

        expect(await form.submit()).toBe(false);
        expect(field.snapshot.hasAny("invisible", "loading")).toBe(false);
    });

    it("une seconde passe n'écrase pas la référence de la première", async () => {
        const form = new FormController<{ a: string }>({ name: "f48" });
        let call = 0;
        const twice: IBehavior<string> = {
            onChange: async (ctx) => {
                call += 1;
                if (call === 1) {
                    ctx.push(ctx.state.mark("busy"));
                    await wait(20);
                    throw new Error("première passe HS");
                }
                await wait(60);
                return ctx.state;
            },
        };
        const field = form.field("a", { behaviors: [twice] });
        field.mount();
        form.mount();
        await wait(20);

        field.change("x");
        await until(() => field.snapshot.hasFlag("busy"));
        // La seconde part pendant que la première est encore en vol.
        field.change("y");

        await wait(150);
        // Si la seconde avait écrasé la référence, `busy` — posé par la
        // première — aurait été considéré comme acquis, et serait resté.
        expect(field.snapshot.hasFlag("busy")).toBe(false);
    });

    it("recover() ne supplante que le behavior qu'il sauve, pas ses voisins", async () => {
        const form = new FormController<{ a: string }>({ name: "f49", settleTimeout: 40 });
        const stuck: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(10_000);
                return ctx.state.idle();
            },
        };
        const quiet: IBehavior<string> = {
            // Même champ, autre behavior : il n'allume jamais `loading`, donc
            // `recover()` n'a rien à lui reprendre.
            onMount: async (ctx) => {
                await wait(120);
                ctx.setValue("écrit après recover");
            },
        };
        const field = form.field("a", { behaviors: [stuck, quiet] });
        field.mount();
        form.mount();

        expect(await form.submit()).toBe(false);
        await until(() => field.snapshot.value === "écrit après recover", { timeout: 1000 });
    });
});

describe("la comptabilité d'une attente suit chaque écriture", () => {
    it("une passe qui ne rend rien libère quand même sa référence", async () => {
        const form = new FormController<{ pays: string; siret: string }>({ name: "f50" });
        const behavior: IBehavior<string> = {
            watch: ["pays"],
            // L'idiome dominant : `async` sans `return`. La passe résout
            // `undefined`, et son entrée doit malgré tout être rendue.
            onMount: async (ctx) => {
                ctx.push(ctx.state.hide());
                await wait(10);
            },
            onDependencyChanged: async (ctx) => {
                // Rien de synchrone avant le premier `await` : un `push` ici
                // nettoierait la référence périmée par un autre chemin, et
                // masquerait le défaut.
                await wait(5);
                ctx.push(ctx.state.mark("checking"));
                await wait(10);
                throw new Error("annuaire HS");
            },
        };
        const pays = form.field("pays", {});
        const siret = form.field("siret", { required: true, behaviors: [behavior] });
        pays.mount();
        siret.mount();
        form.mount();
        await wait(30);
        expect(siret.snapshot.hasFlag("invisible")).toBe(true);
        expect(form.getSnapshot().hasFlag("valid")).toBe(true);

        pays.change("FR");
        await until(() => siret.snapshot.hasFlag("checking"));
        await until(() => !siret.snapshot.hasFlag("checking"), { timeout: 1000 });

        // Une référence périmée faisait ressusciter le champ masqué : il
        // redevenait obligatoire et vide, et le formulaire était condamné.
        expect(siret.snapshot.hasFlag("invisible")).toBe(true);
        expect(form.getSnapshot().hasFlag("valid")).toBe(true);
    });

    it("un onSubmit asynchrone n'écrase pas la référence d'une attente ouverte sans promesse", async () => {
        const form = new FormController<{ a: string }>({ name: "f51", settleTimeout: 40 });
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.loading().hide(),
            onSubmit: async () => { await wait(1); },
        };
        const field = form.field("a", { required: true, initialValue: "gardée", behaviors: [behavior] });
        field.mount();
        form.mount();
        await until(() => field.snapshot.hasFlag("invisible"));

        expect(await form.submit()).toBe(false);
        // Le champ doit revenir, et sa valeur rester dans le payload : sinon le
        // formulaire part vide en se croyant valide.
        expect(field.snapshot.hasFlag("invisible")).toBe(false);
        expect(await form.submit()).toBe(true);
        expect(form.getSnapshot().values).toEqual({ a: "gardée" });
    });

    it("une attente ouverte par un hook synchrone garde ses faits permanents", async () => {
        const form = new FormController<{ a: string }>({ name: "f52", settleTimeout: 40 });
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.readOnly().mark("imported"),
            onChange: (ctx) => {
                // Travail détaché : il retourne `loading` sans rendre de
                // promesse — le motif de `parity.test.ts`.
                void wait(10_000);
                return ctx.state.loading();
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(20);
        expect(field.snapshot.hasFlag("readonly", "imported")).toBe(true);

        field.change("x");
        await until(() => field.snapshot.hasFlag("loading"));
        expect(await form.submit()).toBe(false);

        // `recover()` doit rendre l'attente sans emporter ce que le montage
        // avait posé.
        expect(field.snapshot.hasFlag("loading")).toBe(false);
        expect(field.snapshot.hasFlag("readonly", "imported")).toBe(true);
    });

    it("la passe la plus rapide n'emporte pas la référence de la plus lente", async () => {
        const form = new FormController<{ a: string }>({ name: "f53" });
        let call = 0;
        const behavior: IBehavior<string> = {
            onMount: (ctx) => ctx.state.readOnly().mark("imported"),
            onChange: async (ctx) => {
                call += 1;
                if (call === 1) {
                    await wait(5);
                    ctx.push(ctx.state.mark("busy"));
                    await wait(80);
                    throw new Error("passe lente HS");
                }
                await wait(10);
                return ctx.state;
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();
        await wait(20);

        field.change("x");
        field.change("y");
        await wait(200);

        // La rapide retombe d'abord. Si elle effaçait la référence de la lente,
        // le rejet de celle-ci n'aurait plus rien à quoi se comparer : `busy`
        // resterait posé, et les faits du montage seraient rasés.
        expect(field.snapshot.hasFlag("busy")).toBe(false);
        expect(field.snapshot.hasFlag("readonly", "imported")).toBe(true);
    });

    it("un accesseur `then` piégé ne fait dérailler aucun hook", () => {
        const form = new FormController<{ a: string; b: string }>({ name: "f54" });
        const trapped: IBehavior<string> = {
            onMount: () => ({ get then() { throw new Error("piégé"); } }) as never,
        };
        const a = form.field("a", { behaviors: [trapped] });
        const b = form.field("b", {});
        a.mount();
        b.mount();

        expect(() => form.mount()).not.toThrow();
        expect(b.snapshot.hasFlag("mounted")).toBe(true);
    });
});
