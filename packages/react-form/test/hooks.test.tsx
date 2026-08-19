import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import {
    FormController,
    IValidator,
    type FieldArray,
    type ValidationReport,
} from "slz-form";
import { hooksFor } from "../src/hooksFor";
import { useFieldOn } from "../src/useField";

afterEach(cleanup);

const tick = (ms = 30): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class NonEmpty extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(value.trim() === "", "obligatoire");
    }
}

describe("useField", () => {
    it("rend la valeur du moteur et la met à jour à la saisie", async () => {
        const form = new FormController<{ email: string }>({ name: "r-1" });
        const { useField } = hooksFor(form);

        function Email(): React.ReactElement {
            const field = useField({ name: "email" });
            return (
                <input
                    aria-label="email"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                />
            );
        }

        render(<Email />);
        const input = screen.getByLabelText("email") as HTMLInputElement;
        expect(input.value).toBe("");

        // Par le DOM : c'est `onChange` du hook qui doit écrire dans le moteur.
        await act(async () => {
            fireEvent.change(input, { target: { value: "ada@lovelace.dev" } });
            await tick();
        });
        expect(input.value).toBe("ada@lovelace.dev");
        expect(form.values()).toEqual({ email: "ada@lovelace.dev" });
    });

    it("survit au double montage de StrictMode", async () => {
        const form = new FormController<{ a: string }>({ name: "r-2" });
        const { useField } = hooksFor(form);

        function Field(): React.ReactElement {
            const field = useField({ name: "a", validator: new NonEmpty() });
            return (
                <>
                    <input aria-label="a" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    <span data-testid="flags">{field.flags.join(",")}</span>
                </>
            );
        }

        render(<StrictMode><Field /></StrictMode>);
        await act(async () => {
            fireEvent.change(screen.getByLabelText("a"), { target: { value: "rempli" } });
            await tick();
        });

        expect(screen.getByTestId("flags").textContent).toContain("valid");
        // Un seul champ, donc un seul abonnement effectif malgré le double montage.
        expect(form.values()).toEqual({ a: "rempli" });
    });

    it("démonte le champ quand le composant disparaît", async () => {
        const form = new FormController<{ a: string }>({ name: "r-3" });
        const { useField } = hooksFor(form);

        function Field(): React.ReactElement {
            const field = useField({ name: "a" });
            return <span>{field.name}</span>;
        }

        const view = render(<Field />);
        await act(async () => { await tick(); });
        expect(form.get("a")?.isMounted).toBe(true);

        view.unmount();
        expect(form.get("a")?.isMounted).toBe(false);
    });

    it("n'entretient aucun useState miroir : le snapshot vient du moteur", async () => {
        const form = new FormController<{ a: string }>({ name: "r-4" });
        const { useField } = hooksFor(form);
        let renders = 0;

        function Field(): React.ReactElement {
            renders += 1;
            const field = useField({ name: "a" });
            return <span data-testid="v">{field.value ?? ""}</span>;
        }

        render(<Field />);
        await act(async () => { await tick(); });
        const before = renders;

        // Réécrire la même valeur ne doit produire aucun rendu.
        await act(async () => {
            form.get("a")?.change("x");
            form.get("a")?.change("x");
            await tick();
        });

        expect(screen.getByTestId("v").textContent).toBe("x");
        expect(renders).toBeLessThanOrEqual(before + 2);
    });

    it("un champ qui change ne re-rend pas ses voisins", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "r-5" });
        const { useField } = hooksFor(form);
        let rendersB = 0;

        function A(): React.ReactElement {
            const field = useField({ name: "a" });
            return <span data-testid="a">{field.value ?? ""}</span>;
        }
        function B(): React.ReactElement {
            rendersB += 1;
            const field = useField({ name: "b" });
            return <span>{field.value ?? ""}</span>;
        }

        render(<><A /><B /></>);
        await act(async () => { await tick(); });
        const before = rendersB;

        await act(async () => {
            form.get("a")?.change("nouvelle valeur");
            await tick();
        });

        expect(screen.getByTestId("a").textContent).toBe("nouvelle valeur");
        expect(rendersB).toBe(before);
    });
});

describe("useFieldArray", () => {
    type Line = { label: string };
    type Fields = { lines: FieldArray<Line> };

    it("ajoute, rend et retire des lignes, avec des clés stables", async () => {
        const form = new FormController<Fields>({ name: "r-6" });
        const { useFieldArray } = hooksFor(form);

        function Lines(): React.ReactElement {
            const { rows, append, remove } = useFieldArray("lines");
            return (
                <div>
                    <button onClick={append}>ajouter</button>
                    {rows.map((row) => (
                        <div key={row.id} data-testid="row">
                            <LineLabel row={row} />
                            <button onClick={() => remove(row.id)}>retirer {row.id}</button>
                        </div>
                    ))}
                </div>
            );
        }

        function LineLabel({ row }: { row: { form: FormController<Line> } }): React.ReactElement {
            const field = useFieldOn<string, never>(row.form, { name: "label" });
            return (
                <input
                    aria-label="label"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                />
            );
        }

        render(<Lines />);
        await act(async () => { await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(0);

        const array = form.array("lines");
        await act(async () => { array.append(); await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(1);

        await act(async () => {
            array.rows[0]?.form.get("label")?.change("Prestation");
            await tick();
        });
        expect((screen.getByLabelText("label") as HTMLInputElement).value).toBe("Prestation");
        expect(form.values()).toEqual({ lines: [{ label: "Prestation" }] });

        const id = array.rows[0]?.id ?? "";
        await act(async () => { array.remove(id); await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(0);
    });
});

describe("useForm", () => {
    it("expose la validité et la soumission du formulaire", async () => {
        const form = new FormController<{ a: string }>({ name: "r-7" });
        const { useField, useForm } = hooksFor(form);

        function View(): React.ReactElement {
            const field = useField({ name: "a", required: true });
            const state = useForm();
            return (
                <div>
                    <input aria-label="a" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    <span data-testid="valid">{String(state.isValid)}</span>
                </div>
            );
        }

        render(<View />);
        await act(async () => { await tick(); });
        expect(screen.getByTestId("valid").textContent).toBe("false");

        await act(async () => {
            form.get("a")?.change("rempli");
            await tick();
        });
        expect(screen.getByTestId("valid").textContent).toBe("true");
    });
});

describe("le hook pilote réellement le moteur", () => {
    it("onBlur et onFocus atteignent le contrôleur", async () => {
        const form = new FormController<{ a: string }>({ name: "r-8" });
        const { useField } = hooksFor(form);

        function Field(): React.ReactElement {
            const field = useField({ name: "a" });
            return (
                <input
                    aria-label="a"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onFocus={field.onFocus}
                    onBlur={field.onBlur}
                />
            );
        }

        render(<Field />);
        await act(async () => { await tick(); });
        const input = screen.getByLabelText("a");

        await act(async () => { fireEvent.focus(input); await tick(); });
        expect(form.get("a")?.snapshot.focused).toBe(true);

        await act(async () => { fireEvent.blur(input); await tick(); });
        expect(form.get("a")?.snapshot.focused).toBe(false);
        expect(form.get("a")?.snapshot.touched).toBe(true);
    });

    it("les props repoussées par le parent atteignent le contrôleur", async () => {
        const form = new FormController<{ a: string }>({ name: "r-9" });
        const { useField } = hooksFor(form);

        function Field({ locked }: { locked: boolean }): React.ReactElement {
            const field = useField({ name: "a", required: true, locked });
            return <span data-testid="locked">{String(field.isLocked)}</span>;
        }

        const view = render(<Field locked={false} />);
        await act(async () => { await tick(); });
        expect(screen.getByTestId("locked").textContent).toBe("false");

        await act(async () => { view.rerender(<Field locked />); await tick(); });
        expect(screen.getByTestId("locked").textContent).toBe("true");
        expect(form.get("a")?.snapshot.isLocked).toBe(true);
    });

    it("un champ non piloté n'est pas effacé par les mises à jour", async () => {
        const form = new FormController<{ a: string }>({ name: "r-10" });
        const { useField } = hooksFor(form);

        function Field({ required }: { required: boolean }): React.ReactElement {
            // Aucune prop `value` : le parent ne pilote pas la valeur.
            const field = useField({ name: "a", required });
            return <span data-testid="v">{field.value ?? ""}</span>;
        }

        const view = render(<Field required={false} />);
        await act(async () => {
            form.get("a")?.change("saisie");
            await tick();
        });
        expect(screen.getByTestId("v").textContent).toBe("saisie");

        await act(async () => { view.rerender(<Field required />); await tick(); });
        expect(screen.getByTestId("v").textContent).toBe("saisie");
    });

    it("un champ piloté peut être effacé par le parent", async () => {
        const form = new FormController<{ a: string }>({ name: "r-11" });
        const { useField } = hooksFor(form);

        function Field({ value }: { value: string | undefined }): React.ReactElement {
            const field = useField({ name: "a", value });
            return <span data-testid="v">{field.value ?? "(vide)"}</span>;
        }

        const view = render(<Field value="pilotée" />);
        await act(async () => { await tick(); });
        expect(screen.getByTestId("v").textContent).toBe("pilotée");

        await act(async () => { view.rerender(<Field value={undefined} />); await tick(); });
        expect(screen.getByTestId("v").textContent).toBe("(vide)");
    });

    it("hasFlag reflète l'état réel du champ", async () => {
        const form = new FormController<{ a: string }>({ name: "r-12" });
        const { useField } = hooksFor(form);

        function Field(): React.ReactElement {
            const field = useField({ name: "a", required: true, validator: new NonEmpty() });
            return (
                <>
                    <input aria-label="a" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    <span data-testid="f">{String(field.hasFlag("valid"))}</span>
                </>
            );
        }

        render(<Field />);
        await act(async () => { await tick(); });
        expect(screen.getByTestId("f").textContent).toBe("false");

        await act(async () => {
            fireEvent.change(screen.getByLabelText("a"), { target: { value: "rempli" } });
            await tick();
        });
        expect(screen.getByTestId("f").textContent).toBe("true");
    });

    it("les boutons de useFieldArray ajoutent et retirent des lignes", async () => {
        type Line = { label: string };
        const form = new FormController<{ lines: FieldArray<Line> }>({ name: "r-13" });
        const { useFieldArray } = hooksFor(form);

        function Lines(): React.ReactElement {
            const { rows, append, remove } = useFieldArray("lines");
            return (
                <div>
                    <button onClick={append}>ajouter</button>
                    {rows.map((row) => (
                        <div key={row.id} data-testid="row">
                            <button onClick={() => remove(row.id)}>retirer</button>
                        </div>
                    ))}
                </div>
            );
        }

        render(<Lines />);
        await act(async () => { await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(0);

        await act(async () => { fireEvent.click(screen.getByText("ajouter")); await tick(); });
        await act(async () => { fireEvent.click(screen.getByText("ajouter")); await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(2);

        await act(async () => { fireEvent.click(screen.getAllByText("retirer")[0]!); await tick(); });
        expect(screen.queryAllByTestId("row")).toHaveLength(1);
    });

    it("useForm soumet réellement le formulaire", async () => {
        const form = new FormController<{ a: string }>({ name: "r-14" });
        const { useField, useForm } = hooksFor(form);

        function View(): React.ReactElement {
            const field = useField({ name: "a", required: true });
            const state = useForm();
            return (
                <div>
                    <input aria-label="a" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} />
                    <button onClick={() => void state.submit()}>envoyer</button>
                    <span data-testid="status">{state.snapshot.status}</span>
                </div>
            );
        }

        render(<View />);
        await act(async () => {
            fireEvent.change(screen.getByLabelText("a"), { target: { value: "rempli" } });
            await tick();
        });

        await act(async () => { fireEvent.click(screen.getByText("envoyer")); await tick(60); });
        expect(screen.getByTestId("status").textContent).toBe("submitted");
    });
});
