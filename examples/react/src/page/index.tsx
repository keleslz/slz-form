import { useState } from "react";
import { Tabs, type TabDefinition } from "./shared/Tabs";
import { SlzCarForm } from "./slz";
import { UseStateCarForm } from "./usestate";
import "./shared/layout.css";

const TABS: readonly TabDefinition[] = [
    { id: "slz", label: "slz-form", caption: "moteur" },
    { id: "usestate", label: "useState", caption: "baseline" },
    { id: "complex", label: "Implémentation réelle complexe", caption: "specs à venir", disabled: true },
];

/**
 * Same form, same rules, same markup — only the state management differs from
 * one tab to the next.
 */
export function Page() {
    const [active, setActive] = useState<string>("slz");

    return (
        <div className="page">
            <header className="page__head">
                <h1>Configuration véhicule — même formulaire, deux implémentations</h1>
                <Tabs tabs={TABS} active={active} onSelect={setActive} />
            </header>

            <main className="page__body">
                {active === "slz" && <SlzCarForm />}
                {active === "usestate" && <UseStateCarForm />}
            </main>
        </div>
    );
}
