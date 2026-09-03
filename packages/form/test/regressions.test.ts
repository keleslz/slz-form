import { describe, expect, it } from "vitest";
import {
    Behavior,
    behaviorsFor,
    FormController,
    IValidator,
    type BehaviorContext,
    type FieldArray,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { copyFrom, observes, until, wait } from "./helpers";

/**
 * Un test par bug relevé dans `potentiel-error-to-fix.md`, écrit à partir de la
 * sonde qui l'avait mis en évidence. Ils existent pour que ces comportements ne
 * puissent pas revenir en silence.
 */
describe("régressions", () => {
    it("B1 — reset() restaure la valeur initiale au lieu de vider", () => {
        const form = new FormController<{ z: string }>({ name: "b1" });
        const field = form.field("z", { initialValue: "DEFAUT" });
        field.mount();
        form.mount();

        field.change("modifié");
        form.reset();

        expect(field.snapshot.value).toBe("DEFAUT");
    });

    it("B2 — un formulaire prérempli et correct est valide sans interaction", async () => {
        const form = new FormController<{ a: string }>({ name: "b2" });
        form.field("a", { required: true, initialValue: "rempli" }).mount();
        form.mount();
        await wait(10);

        expect(form.snapshot.hasFlag("valid")).toBe(true);
    });

    it("B2 — un champ obligatoire et vide invalide le formulaire, même non touché", async () => {
        const form = new FormController<{ a: string }>({ name: "b2b" });
        form.field("a", { required: true }).mount();
        form.mount();
        await wait(10);

        expect(form.snapshot.hasFlag("valid")).toBe(false);
    });

    it("B3 — un champ non touché n'affiche pas d'erreur mais porte le verdict", async () => {
        const form = new FormController<{ a: string }>({ name: "b3" });
        const field = form.field("a", { required: true });
        field.mount();
        form.mount();
        await wait(10);

        expect(field.snapshot.ui.validity).toBe("pristine");
        expect(field.snapshot.hasFlag("error")).toBe(false);
        expect(field.snapshot.errors.length > 0).toBe(true);
    });

    it("B4 — un champ invisible et obligatoire ne bloque pas la soumission mais reste dans le payload", async () => {
        const form = new FormController<{ x: string; y: string }>({ name: "b4" });
        const { hideWhen } = behaviorsFor(form);
        const hidden = form.field("y", {
            required: true,
            behaviors: [hideWhen({ watch: ["x"], when: () => true })],
        });
        form.field("x", {}).mount();
        hidden.mount();
        form.mount();
        await wait(20);

        // Masqué = hors validité (la soumission aboutit malgré `required` vide),
        // mais toujours dans le payload tant que monté (arbitrage 35).
        expect(hidden.snapshot.hasFlag("invisible")).toBe(true);
        await expect(form.submit()).resolves.toBe(true);
        expect(form.values()).toHaveProperty("y");
    });

    it("B5 — une réponse lente et périmée n'écrase pas une réponse plus récente", async () => {
        const form = new FormController<{ src: string; list: string }>({ name: "b5" });
        const { loadOptions } = behaviorsFor(form);
        let call = 0;

        const source = form.field("src", {});
        const list = form.field("list", {
            behaviors: [loadOptions({
                field: "list",
                watch: ["src"],
                on: ["dependency"],
                fetch: async () => {
                    call += 1;
                    const mine = call;
                    await wait(mine === 1 ? 200 : 10);
                    return [{ value: `appel-${mine}`, label: `L${mine}` }];
                },
            })],
        });
        source.mount();
        list.mount();
        form.mount();

        source.change("a");
        await wait(5);
        source.change("b");
        await wait(400);

        expect(list.snapshot.options.map((option) => option.value)).toEqual(["appel-2"]);
    });

    it("B6 — une requête qui ne répond jamais ne condamne pas les soumissions suivantes", async () => {
        const form = new FormController<{ q: string }>({ name: "b6", settleTimeout: 150 });
        class NeverResolves extends Behavior<string> {
            async onMount(ctx: BehaviorContext<string>): Promise<never> {
                ctx.push(ctx.state.loading().lock());
                return new Promise<never>(() => undefined);
            }
        }
        const field = form.field("q", { behaviors: [new NeverResolves()] });
        field.mount();
        form.mount();
        // Attendre l'état, pas l'horloge : sous charge, un délai fixe laissait
        // parfois la soumission partir avant que le behavior soit en vol.
        await until(() => field.isBusy, { timeout: 2000 });

        await expect(form.submit()).resolves.toBe(false);
        expect(field.isBusy).toBe(false);
        await expect(form.submit()).resolves.toBe(true);
    });

    it("B7 — une règle croisée est rejouée quand sa dépendance change", async () => {
        const form = new FormController<{ pwd: string; confirm: string }>({ name: "b7" });
        class SameAsPassword extends IValidator<string> {
            override readonly watch = ["pwd"];
            protected validate(value: string, report: ValidationReport, ctx: { watched: (n: string) => { value: unknown } | null }): void {
                report.errorIf(value !== ctx.watched("pwd")?.value, "ne correspond pas");
            }
        }
        const pwd = form.field("pwd", {});
        const confirm = form.field("confirm", { validator: new SameAsPassword() });
        pwd.mount();
        confirm.mount();
        form.mount();

        pwd.change("abc");
        confirm.change("abc");
        await wait(20);
        expect(confirm.snapshot.ui.validity).toBe("valid");

        pwd.change("xyz");
        await wait(30);
        expect(confirm.snapshot.ui.validity).toBe("error");
    });

    it("B8 — une chaîne synchrone a → b → c va jusqu'au bout", async () => {
        const form = new FormController<{ a: string; b: string; c: string }>({ name: "b8" });
        const a = form.field("a", {});
        const b = form.field("b", { behaviors: [copyFrom("a")] });
        const c = form.field("c", { behaviors: [copyFrom("b")] });
        a.mount();
        b.mount();
        c.mount();
        form.mount();

        a.change("1");
        await wait(20);

        expect(b.snapshot.value).toBe("b:1");
        expect(c.snapshot.value).toBe("c:b:1");
    });

    it("B9 — deux soumissions concurrentes n'en produisent qu'une", async () => {
        const form = new FormController<{ r: string }>({ name: "b9" });
        const field = form.field("r", {});
        field.mount();
        form.mount();
        field.change("ok");

        const [first, second] = await Promise.all([form.submit(), form.submit()]);
        expect([first, second].filter(Boolean)).toHaveLength(1);
    });

    it("B10 — un champ démonté n'accepte plus de saisie et sort du payload", () => {
        const form = new FormController<{ g: string }>({ name: "b10" });
        const field = form.field("g", {});
        field.mount();
        form.mount();

        field.change("v1");
        field.unmount();
        field.change("v2");

        expect(field.snapshot.value).toBe("v1");
        expect(form.values()).not.toHaveProperty("g");
    });

    it("B11 — requiredTrue traite false comme vide, required seul ne le fait pas", async () => {
        const strict = new FormController<{ c: boolean }>({ name: "b11a" });
        const checkbox = strict.field("c", { required: true, requiredTrue: true });
        checkbox.mount();
        strict.mount();
        checkbox.change(false);
        await wait(20);
        expect(checkbox.snapshot.ui.validity).toBe("error");

        const lenient = new FormController<{ c: boolean }>({ name: "b11b" });
        const flag = lenient.field("c", { required: true });
        flag.mount();
        lenient.mount();
        flag.change(false);
        await wait(20);
        expect(flag.snapshot.ui.validity).toBe("valid");
    });

    it("B12 — un échec de chargement est signalé, pas confondu avec une liste vide", async () => {
        const form = new FormController<{ list: string }>({ name: "b12" });
        const { loadOptions } = behaviorsFor(form);
        const seen: unknown[] = [];

        form.field("list", {
            behaviors: [loadOptions({
                field: "list",
                fetch: () => Promise.reject(new Error("réseau tombé")),
                onError: (error) => seen.push(error),
            })],
        }).mount();
        form.mount();
        await wait(40);

        expect(seen).toHaveLength(1);
        expect((seen[0] as Error).message).toBe("réseau tombé");
    });

    it("losange — deux chemins vers le même champ ne sont pas un cycle", () => {
        const form = new FormController<{ a: string; b: string; c: string; d: string }>({ name: "losange" });

        expect(() => {
            form.field("a", {});
            form.field("b", { behaviors: [observes("a")] });
            form.field("c", { behaviors: [observes("a")] });
            form.field("d", { behaviors: [observes("b"), observes("c")] });
        }).not.toThrow();
    });

    it("cycle — une vraie boucle reste rejetée au câblage", () => {
        const form = new FormController<{ a: string; b: string }>({ name: "cycle" });
        form.field("a", { behaviors: [observes("b")] });

        expect(() => form.field("b", { behaviors: [observes("a")] })).toThrow(/Circular/);
    });

    it("options — un changement de meta ou de disabled est republié", () => {
        const form = new FormController<{ s: string }>({ name: "options" });
        const field = form.field("s", { options: [{ value: "x", label: "X", disabled: false }] });
        field.mount();
        form.mount();

        const before = field.snapshot;
        field.update({ options: [{ value: "x", label: "X", disabled: true }] });

        expect(field.snapshot).not.toBe(before);
        expect(field.snapshot.options[0]?.disabled).toBe(true);
    });

    it("behavior rejeté — le champ ne reste ni loading ni verrouillé", async () => {
        const form = new FormController<{ a: string }>({ name: "rejet" });
        class Failing extends Behavior<string> {
            async onMount(ctx: BehaviorContext<string>): Promise<never> {
                ctx.push(ctx.state.loading().lock());
                await wait(5);
                throw new Error("réseau tombé");
            }
        }
        const field = form.field("a", { behaviors: [new Failing()] });
        field.mount();
        form.mount();
        await wait(40);

        expect(field.snapshot.hasFlag("locked")).toBe(false);
        expect(field.snapshot.hasFlag("loading")).toBe(false);
    });

    it("B13 — un champ masqué invalide part au payload, hors des errors, sans invalider le form", async () => {
        const form = new FormController<{ x: string; y: string }>({ name: "b5-decouple" });
        const { hideWhen } = behaviorsFor(form);
        class Rejette extends IValidator<string> {
            protected validate(_value: string, report: ValidationReport): void {
                report.error("toujours faux");
            }
        }
        const hidden = form.field("y", {
            initialValue: "valeur-cachée",
            validator: new Rejette(),
            behaviors: [hideWhen({ watch: ["x"], when: () => true })],
        });
        form.field("x", {}).mount();
        hidden.mount();
        form.mount();
        await wait(20);

        expect(hidden.snapshot.hasFlag("invisible")).toBe(true);
        // Le découplage payload / validité (arbitrage 35), épinglé : la valeur du
        // champ masqué part dans le payload...
        expect(form.values()).toHaveProperty("y", "valeur-cachée");
        // ...son constat bloquant reste hors des `errors` du formulaire...
        expect(form.snapshot.errors).not.toHaveProperty("y");
        // ...et le formulaire reste donc valide.
        expect(form.snapshot.hasFlag("valid")).toBe(true);
    });

    it("B14 — une ligne d'array avec un champ masqué envoie sa valeur dans le payload", async () => {
        type Row = { visible: string; caché: string };
        const form = new FormController<{ rows: FieldArray<Row> }>({ name: "b6-array" });
        // Le champ de ligne se masque au montage — le chemin
        // `FieldArrayController.values()` → `row.values()` → `FormSnapshot.values`
        // est partagé, donc un champ masqué de ligne suit la même règle
        // (arbitrage 35) : sa valeur figure au payload tant qu'il est monté.
        const hide: IBehavior<string> = { onMount: (ctx) => ctx.state.hide() };
        const rows = form.array("rows");
        form.mount();

        const id = rows.append();
        const row = rows.row(id);
        row?.field("visible").mount();
        const hidden = row?.field("caché", { behaviors: [hide] });
        hidden?.mount();
        hidden?.change("secret");
        row?.field("visible").change("montré");
        await wait(20);

        expect(hidden?.snapshot.hasFlag("invisible")).toBe(true);
        expect(form.values()).toEqual({ rows: [{ visible: "montré", caché: "secret" }] });
    });
});
