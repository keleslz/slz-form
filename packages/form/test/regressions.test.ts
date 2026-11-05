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

    it("B15 — un select dépendant vidé par sa dépendance n'allume pas « requis »", async () => {
        const form = new FormController<{ brand: string; model: string }>({ name: "b15" });
        const { loadOptions } = behaviorsFor(form);
        const brand = form.field("brand");
        const model = form.field("model", {
            required: true,
            behaviors: [loadOptions({
                field: "model",
                watch: ["brand"],
                fetch: async () => {
                    await wait(10);
                    return [{ value: "a", label: "A" }];
                },
            })],
        });
        brand.mount();
        model.mount();
        form.mount();
        brand.change("peugeot");
        await until(() => model.snapshot.options.length > 0 && !model.snapshot.hasFlag("loading"));

        // L'utilisateur choisit un modèle, puis quitte le champ : il est touché.
        model.change("a");
        model.blur();
        await until(() => model.snapshot.hasFlag("valid"));

        // La marque change : la liste part sous le champ, qui est vidé. Ce
        // n'est pas l'utilisateur qui l'a vidé — « requis » ne doit s'allumer
        // ni pendant le chargement, ni une fois la liste revenue.
        brand.change("renault");
        expect(model.snapshot.value).toBeUndefined();
        expect(model.snapshot.hasFlag("loading")).toBe(true);
        expect(model.snapshot.hasFlag("error")).toBe(false);
        expect(model.snapshot.hasFlag("touched")).toBe(false);

        await until(() => !model.snapshot.hasFlag("loading"));
        await wait(10);
        expect(model.snapshot.hasFlag("error")).toBe(false);
        expect(model.snapshot.hasFlag("pristine")).toBe(true);

        // Le verdict, lui, n'a pas bougé : vide et obligatoire, le formulaire
        // ne part pas — et soumettre rallume l'erreur (arbitrage 24).
        expect(model.snapshot.errors).toHaveLength(1);
        expect(form.snapshot.hasFlag("valid")).toBe(false);
        expect(await form.submit()).toBe(false);
        expect(model.snapshot.hasFlag("error")).toBe(true);
    });

    it("B16 — ctx.clear() éteint l'erreur d'un champ touché resté vide", async () => {
        const form = new FormController<{ source: string; target: string }>({ name: "b16" });
        const clears: IBehavior<string> = {
            watch: ["source"],
            onDependencyChanged: (ctx) => ctx.clear(),
        };
        const source = form.field("source");
        const target = form.field("target", { required: true, behaviors: [clears] });
        source.mount();
        target.mount();
        form.mount();

        // Touché et vide : « requis » est affiché.
        target.blur();
        await until(() => target.snapshot.hasFlag("error"));

        // La valeur ne change pas — elle était déjà vide —, mais le champ
        // repart de zéro : l'erreur s'éteint quand même.
        source.change("x");
        await wait(10);
        expect(target.snapshot.hasFlag("touched")).toBe(false);
        expect(target.snapshot.hasFlag("error")).toBe(false);
        expect(target.snapshot.errors).toHaveLength(1);
    });

    it("B17 — une règle synchrone qui lève ne garde pas son verdict précédent (#18)", async () => {
        class UrlValidator extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                const url = new URL(value);
                report.errorIf(url.protocol !== "https:", "https only");
            }
        }
        const form = new FormController<{ site: string }>({ name: "b17" });
        const site = form.field("site", { required: true, validator: new UrlValidator() });
        site.mount();
        form.mount();

        site.change("https://ok.example");
        await until(() => site.snapshot.ui.validity === "valid");

        site.change("not a url at all");
        await wait(10);

        expect(site.snapshot.errors.length > 0).toBe(true);
        expect(await form.submit()).toBe(false);
        const [reported] = form.engineErrors;
        expect(reported).toMatchObject({ scope: "validator", field: "site", rule: "UrlValidator" });
    });

    it("B18 — le rejugement d'une valeur écrite pendant la soumission est borné par settleTimeout (#19)", async () => {
        // Un lookup écrit pendant la soumission ; la règle juge cette valeur
        // une première fois, puis ne répond plus quand `settle` la rejuge.
        const writesLate: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(20);
                ctx.setValue("tardif");
                return ctx.state.idle();
            },
        };
        let lateCalls = 0;
        class HangsOnRejudge extends IValidator<string> {
            protected async validate(value: string): Promise<void> {
                if (value === "tardif") {
                    lateCalls += 1;
                    if (lateCalls > 1) {
                        return new Promise<void>(() => {});
                    }
                }
                await wait(1);
            }
        }
        const form = new FormController<{ a: string }>({ name: "b18", settleTimeout: 150 });
        const field = form.field("a", { behaviors: [writesLate], validator: new HangsOnRejudge() });
        field.mount();
        form.mount();
        field.change("ok");
        await until(() => field.snapshot.ui.validity === "valid");

        const started = Date.now();
        const result = await Promise.race([form.submit(), wait(1500).then(() => "pendu" as const)]);

        expect(result).toBe(false);
        expect(Date.now() - started).toBeLessThan(1000);
        expect(lateCalls).toBeGreaterThan(1);
        expect(form.snapshot.hasFlag("submitting")).toBe(false);
        expect(field.snapshot.hasAny("locked", "submitting", "loading")).toBe(false);
        // La passe abandonnée n'est pas un verdict : la valeur est non vérifiée.
        expect(field.snapshot.errors).toEqual(["Validation unavailable"]);
    });

    it("B20 — garde-fou : une liste aux règles lentes se soumet, sans laisser de ligne verrouillée (pas d'échéance unique)", async () => {
        class Slow extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(120);
            }
        }
        type Fields = { a: string; lines: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "b20", settleTimeout: 200 });
        const a = form.field("a", { validator: new Slow(), initialValue: "ok" });
        a.mount();
        const lines = form.array("lines");
        const id = lines.append();
        const label = lines.row(id)?.form.field("label", { validator: new Slow(), initialValue: "x" });
        label?.mount();
        form.mount();
        await until(() => !a.isBusy && label?.isBusy === false, { timeout: 2000 });

        // Chaque étape tient dans son propre délai : la soumission passe.
        await expect(form.submit()).resolves.toBe(true);
        expect(label?.snapshot.hasAny("locked", "submitting")).toBe(false);
        expect(a.snapshot.hasAny("locked", "submitting")).toBe(false);
    });

    it("B21 — une soumission supplantée par reset() ne relâche pas celle qui l'a suivie (#19)", async () => {
        const releases: (() => void)[] = [];
        const slow: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await new Promise<void>((resolve) => { releases.push(resolve); });
                return ctx.state.idle();
            },
        };
        const form = new FormController<{ a: string }>({ name: "b21", settleTimeout: 100 });
        const field = form.field("a", { behaviors: [slow], initialValue: "x" });
        field.mount();
        form.mount();

        // La première part, est supplantée par `reset()`, puis une deuxième
        // part 60 ms plus tard : la première expire donc en pleine deuxième.
        const first = form.submit();
        await wait(60);
        form.reset();
        const second = form.submit();

        await expect(first).resolves.toBe(false);
        // Elle ne doit ni relâcher les verrous de la deuxième, ni remettre le
        // formulaire à `idle` — ce qui laisserait partir une troisième.
        expect(form.snapshot.status).toBe("submitting");
        expect(field.snapshot.hasAny("locked", "submitting")).toBe(true);
        await expect(form.submit()).resolves.toBe(false);

        releases[1]?.();
        await expect(second).resolves.toBe(true);
        expect(field.snapshot.hasAny("locked", "submitting")).toBe(false);
    });

    it("B22 — garde-fou : un champ retiré pendant la soumission n'y reste pas verrouillé (jeton de soumission)", async () => {
        let release: () => void = () => {};
        const slow: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await new Promise<void>((resolve) => { release = resolve; });
                return ctx.state.idle();
            },
        };
        const form = new FormController<{ a: string; b: string }>({ name: "b22" });
        const a = form.field("a", { behaviors: [slow], initialValue: "x" });
        const b = form.field("b", { initialValue: "y" });
        a.mount();
        b.mount();
        form.mount();

        const pending = form.submit();
        await until(() => b.snapshot.hasFlag("submitting"));
        form.remove("b");
        form.reset();
        release();
        await pending;

        expect(b.snapshot.hasAny("locked", "submitting")).toBe(false);
    });

    it("B19 — reset() pendant une soumission déverrouille les champs, et la soumission périmée ne réécrit rien (#19)", async () => {
        let release: () => void = () => {};
        const slow: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await new Promise<void>((resolve) => { release = resolve; });
                return ctx.state.idle();
            },
        };
        const form = new FormController<{ a: string }>({ name: "b19" });
        const field = form.field("a", { behaviors: [slow], initialValue: "x" });
        field.mount();
        form.mount();

        const pending = form.submit();
        await until(() => field.snapshot.hasFlag("submitting"));

        form.reset();
        expect(form.snapshot.status).toBe("idle");
        expect(field.snapshot.hasAny("locked", "submitting")).toBe(false);

        // La soumission d'avant la remise à zéro finit par retomber : elle ne
        // doit ni marquer le formulaire « submitted », ni toucher aux verrous.
        release();
        await pending;
        expect(form.snapshot.status).toBe("idle");
        expect(field.snapshot.hasAny("locked", "submitting")).toBe(false);
    });

    it("B23 — une soumission supplantée par reset() ne soumet pas les lignes du formulaire remis à zéro (#19)", async () => {
        class Slow extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(50);
            }
        }
        type Fields = { a: string; lines: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "b23" });
        const a = form.field("a", { validator: new Slow(), initialValue: "ok" });
        a.mount();
        form.mount();
        await until(() => !a.isBusy, { timeout: 2000 });

        const stale = form.submit();
        await wait(10);
        form.reset();
        // Une ligne ajoutée après la remise à zéro appartient au formulaire neuf.
        const lines = form.array("lines");
        const row = lines.row(lines.append());
        const label = row?.form.field("label", { initialValue: "x" });
        label?.mount();

        await expect(stale).resolves.toBe(false);
        expect(label?.snapshot.hasFlag("touched")).toBe(false);
        expect(row?.form.snapshot.status).toBe("idle");
    });

    it("B24 — garde-fou : le rejugement a son propre settleTimeout, il ne prend pas le reste de l'attente", async () => {
        // La valeur écrite tard est jugée vite à l'écriture, puis rejugée
        // lentement : l'attente finit juste avant son échéance, et le
        // rejugement, qui tient dans un délai entier, doit pouvoir aboutir.
        const writesLate: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(80);
                ctx.setValue("tardif");
                return ctx.state.idle();
            },
        };
        let lateCalls = 0;
        class SlowOnRejudge extends IValidator<string> {
            protected async validate(value: string): Promise<void> {
                if (value === "tardif") {
                    lateCalls += 1;
                    await wait(lateCalls > 1 ? 50 : 1);
                }
            }
        }
        const form = new FormController<{ a: string }>({ name: "b24", settleTimeout: 100 });
        const field = form.field("a", { behaviors: [writesLate], validator: new SlowOnRejudge(), initialValue: "ok" });
        field.mount();
        form.mount();
        await until(() => !field.isBusy);

        await expect(form.submit()).resolves.toBe(true);
        expect(lateCalls).toBeGreaterThan(1);
    });

    it("B25 — un reset() synchrone au démarrage de submit() ne laisse aucun champ verrouillé (#19)", async () => {
        // Depuis un abonné du champ : le `reset()` tombe au milieu du
        // verrouillage des champs.
        const form = new FormController<{ a: string; b: string }>({ name: "b25-field" });
        const a = form.field("a", { initialValue: "x" });
        const b = form.field("b", { initialValue: "y" });
        a.mount();
        b.mount();
        form.mount();
        let resetOnce = false;
        a.listen(() => {
            if (!resetOnce && a.snapshot.hasFlag("submitting")) {
                resetOnce = true;
                form.reset();
            }
        });

        await expect(form.submit()).resolves.toBe(false);
        expect(form.snapshot.status).toBe("idle");
        expect(a.snapshot.hasAny("locked", "submitting")).toBe(false);
        expect(b.snapshot.hasAny("locked", "submitting")).toBe(false);

        // Depuis un abonné du formulaire : le `reset()` tombe au passage en
        // « submitting », avant que la soumission ait pris son jeton.
        const other = new FormController<{ c: string }>({ name: "b25-form" });
        const c = other.field("c", { initialValue: "z" });
        c.mount();
        other.mount();
        let resetOther = false;
        other.listen(() => {
            if (!resetOther && other.snapshot.status === "submitting") {
                resetOther = true;
                other.reset();
            }
        });

        await expect(other.submit()).resolves.toBe(false);
        expect(other.snapshot.status).toBe("idle");
        expect(c.snapshot.hasAny("locked", "submitting")).toBe(false);
    });

    it("B26 — une soumission supplantée ne rejuge pas les champs du formulaire remis à zéro (#19)", async () => {
        const slow: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(60);
                return ctx.state.idle();
            },
        };
        let initCalls = 0;
        class Counts extends IValidator<string> {
            protected validate(value: string): void {
                if (value === "init") {
                    initCalls += 1;
                }
            }
        }
        const form = new FormController<{ a: string }>({ name: "b26" });
        const field = form.field("a", { behaviors: [slow], validator: new Counts(), initialValue: "init" });
        field.mount();
        form.mount();
        field.change("saisi");
        await until(() => !field.isBusy);

        const stale = form.submit();
        await wait(20);
        // La remise à zéro rend la valeur initiale et la juge, une fois.
        form.reset();
        const afterReset = initCalls;
        await expect(stale).resolves.toBe(false);
        await wait(20);

        // La soumission périmée voit la valeur changer pendant son attente :
        // elle ne doit pas la rejuger pour autant.
        expect(initCalls).toBe(afterReset);
    });
});
