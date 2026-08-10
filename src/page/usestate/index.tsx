/* eslint-disable react-hooks/set-state-in-effect -- see the note below */

// The 5 violations silenced above are not an oversight, they are the result of
// the exercise. `react-hooks` flags every `setState` called synchronously inside
// an effect (cascading renders). Loading an option list, clearing a dependent
// field and prefilling from an API are exactly that pattern, and there is no way
// to express them with `useState` + `useEffect` without it. The engine tab, which
// renders the same form, triggers zero.

import { useEffect, useMemo, useRef, useState } from "react";
import { isPlateAvailable } from "../../api/check-plate-availability";
import { fetchBrands } from "../../api/fetch-brands";
import { fetchCustomerReference } from "../../api/fetch-customer-reference";
import { fetchModels } from "../../api/fetch-models";
import { fetchOptionPacks } from "../../api/fetch-option-packs";
import type { Option } from "../../api/types";
import { PLATE_TAKEN, validatePlateFormat } from "../../validation";
import { DebugOverlay } from "../shared/DebugOverlay";
import { FieldShell } from "../shared/FieldShell";
import { FUEL_OPTIONS } from "../shared/fuelOptions";
import {
    CheckboxInput,
    DateInput,
    FileInput,
    MultiSelectInput,
    NumberInput,
    RadioInput,
    SelectInput,
    TextAreaInput,
    TextInput,
} from "../shared/input";
import { countRender } from "../shared/renderCounter";
import { FormDebug } from "./FormDebug";
import { validateAll } from "./validate";
import { INITIAL_VALUES, type FieldName, type Values } from "./values";

const id = (name: string) => `usestate:${name}`;

/**
 * The same form, written the ordinary way: `useState` + `useEffect`, no engine.
 *
 * Everything the engine did on its own is here, by hand — async option loading,
 * the dependent select, the prefill, the conditional field, the cross-field
 * lock, the request-race guard, the touched/error bookkeeping. It all lives in
 * this single component, because that is where React state lives.
 */
export function UseStateCarForm() {
    const renders = countRender("usestate:form");

    // ── state ────────────────────────────────────────────────────────────
    const [values, setValues] = useState<Values>(INITIAL_VALUES);
    const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

    const [brands, setBrands] = useState<readonly Option[]>([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [models, setModels] = useState<readonly Option[]>([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [packs, setPacks] = useState<readonly Option[]>([]);
    const [packsLoading, setPacksLoading] = useState(false);
    const [referenceLoading, setReferenceLoading] = useState(false);

    const [plateChecking, setPlateChecking] = useState(false);
    const [plateAsyncError, setPlateAsyncError] = useState<string>();
    const plateRun = useRef(0);

    const [submitting, setSubmitting] = useState(false);

    // ── effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setBrandsLoading(true);
        fetchBrands()
            .then((options) => { if (!cancelled) setBrands(options); })
            .catch(() => { if (!cancelled) setBrands([]); })
            .finally(() => { if (!cancelled) setBrandsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setPacksLoading(true);
        fetchOptionPacks()
            .then((options) => { if (!cancelled) setPacks(options); })
            .catch(() => { if (!cancelled) setPacks([]); })
            .finally(() => { if (!cancelled) setPacksLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setReferenceLoading(true);
        fetchCustomerReference()
            .then((reference) => {
                // Must not mark the field touched: a prefill is not an interaction.
                if (!cancelled) setValues((current) => ({ ...current, customerReference: reference }));
            })
            .catch(() => undefined)
            .finally(() => { if (!cancelled) setReferenceLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // dependent select: reload the models and clear the current one
    useEffect(() => {
        if (!values.brand) {
            setModels([]);
            return;
        }
        let cancelled = false;
        setModelsLoading(true);
        setValues((current) => (current.model === "" ? current : { ...current, model: "" }));
        fetchModels(values.brand)
            .then((options) => { if (!cancelled) setModels(options); })
            .catch(() => { if (!cancelled) setModels([]); })
            .finally(() => { if (!cancelled) setModelsLoading(false); });
        return () => { cancelled = true; };
    }, [values.brand]);

    // async uniqueness check, with a manual race guard so a stale answer cannot win
    useEffect(() => {
        if (values.plate === "" || validatePlateFormat(values.plate)) {
            setPlateAsyncError(undefined);
            setPlateChecking(false);
            return;
        }
        const run = plateRun.current + 1;
        plateRun.current = run;
        setPlateChecking(true);
        isPlateAvailable(values.plate.toUpperCase())
            .then((available) => {
                if (run !== plateRun.current) return;
                setPlateAsyncError(available ? undefined : PLATE_TAKEN);
            })
            .catch(() => undefined)
            .finally(() => { if (run === plateRun.current) setPlateChecking(false); });
    }, [values.plate]);

    // ── derived ──────────────────────────────────────────────────────────
    const errors = useMemo(() => {
        const computed = validateAll(values);
        if (!computed.plate && plateAsyncError) {
            computed.plate = plateAsyncError;
        }
        return computed;
    }, [values, plateAsyncError]);

    const isValid = Object.keys(errors).length === 0;

    // every display condition has to be recomposed by hand, field by field
    const showOtherBrand = values.brand === "other";
    const deliveryLocked = !values.consent || submitting;

    // ── handlers ─────────────────────────────────────────────────────────
    function set<K extends FieldName>(name: K, value: Values[K]) {
        setValues((current) => ({ ...current, [name]: value }));
        setTouched((current) => ({ ...current, [name]: true }));
    }

    function blur(name: FieldName) {
        setTouched((current) => ({ ...current, [name]: true }));
    }

    function shell(name: FieldName) {
        return {
            id: id(name),
            showError: Boolean(touched[name] && errors[name]),
            error: errors[name],
        };
    }

    async function submit() {
        setSubmitting(true);
        setTouched(Object.fromEntries(
            (Object.keys(values) as FieldName[]).map((name) => [name, true]),
        ) as Partial<Record<FieldName, boolean>>);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSubmitting(false);
    }

    function reset() {
        setValues(INITIAL_VALUES);
        setTouched({});
        setPlateAsyncError(undefined);
        plateRun.current += 1;
    }

    // ── render ───────────────────────────────────────────────────────────
    return (
        <>
            <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
                <section className="panel">
                    <h2>Texte</h2>

                    <FieldShell {...shell("fullName")} label="Nom complet" required>
                        <TextInput
                            value={values.fullName} placeholder="Ada Lovelace" disabled={submitting}
                            onChange={(v) => set("fullName", v)} onBlur={() => blur("fullName")}
                        />
                    </FieldShell>

                    <FieldShell {...shell("email")} label="Email" required hint="Validation synchrone">
                        <TextInput
                            kind="email" value={values.email} disabled={submitting}
                            onChange={(v) => set("email", v)} onBlur={() => blur("email")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("plate")} label="Plaque d'immatriculation" required
                        isLoading={plateChecking}
                        hint="Validation asynchrone — spinner et garde de course à la main"
                    >
                        <TextInput
                            value={values.plate} disabled={submitting}
                            onChange={(v) => set("plate", v)} onBlur={() => blur("plate")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("customerReference")} label="Référence client"
                        isLoading={referenceLoading}
                        hint="Prefill API : verrouillage et non-marquage `touched` à la main"
                    >
                        <TextInput
                            value={values.customerReference} disabled={referenceLoading || submitting}
                            onChange={(v) => set("customerReference", v)} onBlur={() => blur("customerReference")}
                        />
                    </FieldShell>

                    <FieldShell {...shell("comment")} label="Commentaire">
                        <TextAreaInput
                            value={values.comment} rows={3} disabled={submitting}
                            onChange={(v) => set("comment", v)} onBlur={() => blur("comment")}
                        />
                    </FieldShell>
                </section>

                <section className="panel">
                    <h2>Sélection</h2>

                    <FieldShell
                        {...shell("brand")} label="Marque" required isLoading={brandsLoading}
                        hint="Options chargées en API au montage"
                    >
                        <SelectInput
                            options={brands} value={values.brand} disabled={brandsLoading || submitting}
                            onChange={(v) => set("brand", v ?? "")} onBlur={() => blur("brand")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("model")} label="Modèle" required isLoading={modelsLoading}
                        hint="Rechargement et vidage pilotés par un useEffect sur `brand`"
                    >
                        <SelectInput
                            options={models} value={values.model}
                            disabled={modelsLoading || !values.brand || submitting}
                            onChange={(v) => set("model", v ?? "")} onBlur={() => blur("model")}
                        />
                    </FieldShell>

                    {showOtherBrand && (
                        <FieldShell
                            {...shell("otherBrand")} label="Précisez la marque"
                            hint="Condition écrite dans le JSX"
                        >
                            <TextInput
                                value={values.otherBrand} disabled={submitting}
                                onChange={(v) => set("otherBrand", v)} onBlur={() => blur("otherBrand")}
                            />
                        </FieldShell>
                    )}

                    <FieldShell {...shell("fuel")} label="Motorisation" required>
                        <RadioInput
                            name="usestate-fuel" options={FUEL_OPTIONS} value={values.fuel} disabled={submitting}
                            onChange={(v) => set("fuel", v)} onBlur={() => blur("fuel")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("packs")} label="Options" isLoading={packsLoading}
                        hint="Valeur `string[]` — 2 maximum"
                    >
                        <MultiSelectInput
                            options={packs} value={values.packs} disabled={packsLoading || submitting}
                            onChange={(v) => set("packs", v)} onBlur={() => blur("packs")}
                        />
                    </FieldShell>
                </section>

                <section className="panel">
                    <h2>Nombre, dates, fichier</h2>

                    <FieldShell {...shell("mileage")} label="Kilométrage" required hint="Valeur `number`">
                        <NumberInput
                            min={0} max={300000} step={1000} value={values.mileage} disabled={submitting}
                            onChange={(v) => set("mileage", v)} onBlur={() => blur("mileage")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("consent")} label="J'accepte les conditions"
                        hint="Valeur `boolean` — débloque la date de livraison"
                    >
                        <CheckboxInput
                            checked={values.consent} disabled={submitting}
                            onChange={(v) => set("consent", v)} onBlur={() => blur("consent")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("deliveryDate")} label="Date de livraison" required
                        hint="Verrouillage recomposé à la main : !consent || submitting"
                    >
                        <DateInput
                            kind="date" value={values.deliveryDate} disabled={deliveryLocked}
                            onChange={(v) => set("deliveryDate", v)} onBlur={() => blur("deliveryDate")}
                        />
                    </FieldShell>

                    <FieldShell {...shell("deliverySlot")} label="Créneau" hint="Entre 08:00 et 19:00">
                        <DateInput
                            kind="time" value={values.deliverySlot} disabled={submitting}
                            onChange={(v) => set("deliverySlot", v)} onBlur={() => blur("deliverySlot")}
                        />
                    </FieldShell>

                    <FieldShell {...shell("inspectionAt")} label="Rendez-vous contrôle">
                        <DateInput
                            kind="datetime-local" value={values.inspectionAt} disabled={submitting}
                            onChange={(v) => set("inspectionAt", v)} onBlur={() => blur("inspectionAt")}
                        />
                    </FieldShell>

                    <FieldShell
                        {...shell("licence")} label="Permis de conduire" required
                        hint="Valeur `File` — PNG/JPEG, 512 Ko max"
                    >
                        <FileInput
                            accept="image/png,image/jpeg" disabled={submitting}
                            onChange={(v) => set("licence", v)} onBlur={() => blur("licence")}
                        />
                    </FieldShell>
                </section>
            </form>

            <div className="actions">
                <span className={`chip chip--${isValid ? "valid" : "error"}`}>
                    {isValid ? "valide" : "incomplet"}
                </span>
                <button type="button" onClick={() => void submit()} disabled={submitting}>
                    {submitting ? "Envoi…" : "Soumettre"}
                </button>
                <button type="button" className="ghost" onClick={reset}>Réinitialiser</button>
                <span className="chip chip--renders" title="rendus du composant formulaire">↻ {renders}</span>
            </div>

            <DebugOverlay title="État du formulaire — useState">
                <FormDebug
                    values={values}
                    touched={touched}
                    errors={errors}
                    submitting={submitting}
                    loading={{
                        brands: brandsLoading,
                        models: modelsLoading,
                        packs: packsLoading,
                        reference: referenceLoading,
                        plate: plateChecking,
                    }}
                />
            </DebugOverlay>
        </>
    );
}
