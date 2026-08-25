import { describe, expect, it } from "vitest";
import {
    BehaviorState,
    FormController,
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
