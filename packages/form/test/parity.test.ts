import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    ExternalValidator,
    FormController,
    IValidator,
    type BehaviorContext,
    type FieldOption,
    type IBehavior,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { copyFrom, until, wait } from "./helpers";

/**
 * Le critère d'acceptation du chantier : chaque cas que l'audit avait classé
 * « impossible » ou « possible seulement en trichant » doit s'écrire avec un
 * **behavior** ou un **validator**, et rien d'autre.
 *
 * La règle que ces tests font respecter : aucun d'eux ne capture le
 * `FormController` par closure. Tout passe par `ctx` — c'est précisément ce que
 * l'audit reprochait aux contournements d'alors, puisqu'ils contredisaient les
 * invariants affichés par le projet.
 */
describe("parité — ce qui exigeait de modifier le cœur", () => {
    it("validation croisée : le validator déclare et lit, sans connaître le formulaire", async () => {
        class SameAs extends IValidator<string> {
            readonly other: string;
            override readonly watch: readonly string[];

            constructor(other: string) {
                super();
                this.other = other;
                this.watch = [other];
            }

            protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
                report.errorIf(value !== ctx.watched(this.other)?.value, "ne correspond pas");
            }
        }

        const form = new FormController<{ pwd: string; confirm: string }>({ name: "p1" });
        const pwd = form.field("pwd", {});
        const confirm = form.field("confirm", { validator: new SameAs("pwd") });
        pwd.mount();
        confirm.mount();
        form.mount();

        pwd.change("secret");
        confirm.change("secret");
        await wait(20);
        expect(confirm.snapshot.ui.validity).toBe("valid");

        pwd.change("autre");
        await wait(30);
        expect(confirm.snapshot.ui.validity).toBe("error");
    });

    it("réagir à l'ÉTAT d'un voisin, et non à sa valeur", async () => {
        const lockUntilNeighbourValid: IBehavior<string> = {
            watch: [{ field: "src", on: ["validity"] }],
            onMount: (ctx) => ctx.state.lock(),
            onDependencyChanged: (ctx, dependency) =>
                (dependency.ui.validity === "valid" ? ctx.state.unlock() : ctx.state.lock()),
        };

        class NonEmpty extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value.trim() === "", "obligatoire");
            }
        }

        const form = new FormController<{ src: string; dst: string }>({ name: "p2" });
        const src = form.field("src", { validator: new NonEmpty() });
        const dst = form.field("dst", { behaviors: [lockUntilNeighbourValid] });
        src.mount();
        dst.mount();
        form.mount();
        await wait(20);
        expect(dst.snapshot.hasFlag("locked")).toBe(true);

        src.change("rempli");
        await wait(30);
        expect(dst.snapshot.hasFlag("locked")).toBe(false);
    });

    it("`required` conditionnel : la règle vit dans le validator, pas dans la vue", async () => {
        class RequiredWhenPro extends IValidator<string> {
            override readonly watch = ["accountType"];
            // La règle décide elle-même de l'obligation : elle doit donc être
            // consultée y compris quand le champ est vide.
            override readonly validateWhenEmpty = true;

            protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
                const pro = ctx.watched("accountType")?.value === "pro";
                report.errorIf(pro && (value ?? "").trim() === "", "obligatoire pour un compte pro");
            }
        }

        const form = new FormController<{ accountType: string; vat: string }>({ name: "p3" });
        const type = form.field("accountType", {});
        const vat = form.field("vat", { validator: new RequiredWhenPro() });
        type.mount();
        vat.mount();
        form.mount();

        type.change("particulier");
        vat.change(" ");
        await wait(20);
        expect(vat.snapshot.ui.validity).toBe("valid");

        type.change("pro");
        await wait(30);
        expect(vat.snapshot.ui.validity).toBe("error");
    });

    it("erreurs serveur : un validator les porte, l'invariant 13 tient", async () => {
        const serverIssues = new ExternalValidator<string>();
        const form = new FormController<{ email: string }>({ name: "p4" });
        const email = form.field("email", { validator: [serverIssues] });
        email.mount();
        form.mount();
        email.change("ada@lovelace.dev");
        await wait(20);

        serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
        await wait(30);
        expect(email.snapshot.issues[0]?.code).toBe("taken");
        expect(form.snapshot.hasFlag("valid")).toBe(false);
    });

    it("avertissement non bloquant : signalé, sans peser sur la soumission", async () => {
        class Unusual extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.warnIf(!value.startsWith("75"), "code postal inhabituel", { code: "unusual" });
            }
        }
        const form = new FormController<{ postcode: string }>({ name: "p5" });
        const postcode = form.field("postcode", { validator: new Unusual() });
        postcode.mount();
        form.mount();
        postcode.change("13001");
        await wait(20);

        expect(postcode.snapshot.warnings).toEqual(["code postal inhabituel"]);
        await expect(form.submit()).resolves.toBe(true);
    });

    it("readonly : lisible et non modifiable, distinct de grisé", async () => {
        const readOnlyWhileQuoted: IBehavior<string> = {
            watch: ["status"],
            onDependencyChanged: (ctx, dependency) =>
                (dependency.value === "quoted" ? ctx.state.readOnly() : ctx.state.writable()),
        };
        const form = new FormController<{ status: string; amount: string }>({ name: "p6" });
        const status = form.field("status", {});
        const amount = form.field("amount", { behaviors: [readOnlyWhileQuoted] });
        status.mount();
        amount.mount();
        form.mount();

        status.change("quoted");
        await wait(20);
        expect(amount.snapshot.hasFlag("readonly")).toBe(true);
        expect(amount.snapshot.hasFlag("locked")).toBe(false);
    });

    it("échec réseau : discernable d'une liste légitimement vide", async () => {
        const form = new FormController<{ list: string }>({ name: "p7" });
        const { loadOptions } = behaviorsFor(form);
        const failures: unknown[] = [];

        form.field("list", {
            behaviors: [loadOptions({
                field: "list",
                fetch: () => Promise.reject(new Error("503")),
                onError: (error) => failures.push(error),
            })],
        }).mount();
        form.mount();
        await wait(40);

        expect(failures).toHaveLength(1);
    });

    it("pagination : un behavior accumule ses options sans état partagé entre champs", async () => {
        const paginated = (): IBehavior<string> => {
            // L'état vit par nom de champ, comme les debouncers de `loadOptions` :
            // partager l'instance entre deux champs ne les couple pas.
            const pages = new Map<string, FieldOption<string>[]>();
            const loadPage = async (ctx: BehaviorContext<string>): Promise<void> => {
                const accumulated = pages.get(ctx.name) ?? [];
                const page = accumulated.length / 2 + 1;
                await wait(5);
                accumulated.push(
                    { value: `p${page}-a`, label: `Page ${page} A` },
                    { value: `p${page}-b`, label: `Page ${page} B` },
                );
                pages.set(ctx.name, accumulated);
                ctx.setOptions([...accumulated]);
            };
            return {
                onMount: (ctx) => void loadPage(ctx),
                onBlur: (ctx) => void loadPage(ctx),
            };
        };

        // Deux champs, **une seule instance** de behavior : c'est là que
        // l'isolation se vérifie. Avec un seul champ, la propriété annoncée ne
        // serait jamais exercée.
        const shared = paginated();
        const form = new FormController<{ city: string; town: string }>({ name: "p8" });
        const city = form.field("city", { behaviors: [shared] });
        const town = form.field("town", { behaviors: [shared] });
        city.mount();
        town.mount();
        form.mount();
        await wait(40);
        expect(city.snapshot.options).toHaveLength(2);
        expect(town.snapshot.options).toHaveLength(2);

        city.blur();
        await wait(40);
        expect(city.snapshot.options).toHaveLength(4);
        expect(city.snapshot.options[2]?.value).toBe("p2-a");
        // L'autre champ n'a pas bougé : les accumulations ne se mélangent pas.
        expect(town.snapshot.options).toHaveLength(2);
    });

    it("chaîne synchrone : plus besoin de différer l'écriture d'une microtâche", async () => {
        const form = new FormController<{ a: string; b: string; c: string }>({ name: "p9" });
        const a = form.field("a", {});
        const b = form.field("b", { behaviors: [copyFrom("a")] });
        const c = form.field("c", { behaviors: [copyFrom("b")] });
        a.mount();
        b.mount();
        c.mount();
        form.mount();

        a.change("1");
        await wait(20);
        expect(c.snapshot.value).toBe("c:b:1");
    });

    it("champ conditionnel obligatoire : masqué veut dire hors du formulaire", async () => {
        const form = new FormController<{ brand: string; otherBrand: string }>({ name: "p10" });
        const { hideWhen } = behaviorsFor(form);
        const brand = form.field("brand", {});
        const other = form.field("otherBrand", {
            required: true,
            behaviors: [hideWhen({ watch: ["brand"], when: (deps) => deps.brand !== "autre" })],
        });
        brand.mount();
        other.mount();
        form.mount();

        brand.change("renault");
        await wait(30);
        expect(other.snapshot.hasFlag("invisible")).toBe(true);
        await expect(form.submit()).resolves.toBe(true);

        brand.change("autre");
        await wait(30);
        expect(other.snapshot.hasFlag("invisible")).toBe(false);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("skeleton pendant un chargement : un flag de l'application suffit", async () => {
        // Le cas qui a motivé l'ouverture du vocabulaire. Le moteur ne connaît
        // ni « skeleton » ni ce qu'il faut en faire ; il le transporte, la vue
        // en décide. Rien n'est capturé : tout passe par `ctx`.
        const form = new FormController<{ profile: string }>({ name: "p11" });
        const loadProfile: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.mark("skeleton"));
                await wait(20);
                if (ctx.signal.aborted) {
                    return;
                }
                ctx.setValue("Ada");
                return ctx.state.unmark("skeleton");
            },
        };
        const profile = form.field("profile", { behaviors: [loadProfile] });
        profile.mount();
        form.mount();

        await until(() => profile.snapshot.hasFlag("skeleton"));
        // Un squelette n'est pas un verrou : la lib n'impose pas le couple.
        expect(profile.snapshot.hasFlag("locked")).toBe(false);

        await until(() => profile.snapshot.value === "Ada");
        expect(profile.snapshot.hasFlag("skeleton")).toBe(false);
    });
});
