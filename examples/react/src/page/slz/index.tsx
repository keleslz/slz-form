import { CAR_CONFIGURATION_FORM } from "../../form";
import {
    brandOptions,
    customerReferencePrefill,
    lockedUntilConsent,
    modelOptions,
    onlyWhenBrandIsOther,
    packOptions,
} from "../../form/behavior";
import {
    ConsentValidator,
    EmailValidator,
    FileValidator,
    NotInThePastValidator,
    NumberRangeValidator,
    PlateValidator,
    SelectionCountValidator,
    TimeWindowValidator,
} from "../../form/validator";
import { DebugOverlay } from "../shared/DebugOverlay";
import { FUEL_OPTIONS } from "../shared/fuelOptions";
import {
    CheckboxField,
    DateField,
    FileField,
    MultiSelectField,
    NumberField,
    RadioField,
    SelectField,
    TextAreaField,
    TextField,
} from "./field";
import { FormActions } from "./FormActions";
import { FormDebug } from "./FormDebug";

const FORM = CAR_CONFIGURATION_FORM;

/**
 * Every field declares what it is and what is plugged into it. There is no
 * state, no effect and no orchestration in this file — the engine holds all of it.
 */
export function SlzCarForm() {
    return (
        <>
            <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
                <section className="panel">
                    <h2>Texte</h2>

                    <TextField form={FORM} name="fullName" label="Nom complet" required
                        placeholder="Ada Lovelace" />

                    <TextField form={FORM} name="email" label="Email" kind="email" required
                        validator={new EmailValidator()}
                        hint="Validation synchrone" />

                    <TextField form={FORM} name="plate" label="Plaque d'immatriculation" required
                        validator={new PlateValidator()}
                        hint="Validation asynchrone — flag `loading` pendant l'appel" />

                    <TextField form={FORM} name="customerReference" label="Référence client"
                        behaviors={[customerReferencePrefill]}
                        hint="Prefill API : verrouillé et `loading`, reste `pristine`" />

                    <TextAreaField form={FORM} name="comment" label="Commentaire" rows={3} />
                </section>

                <section className="panel">
                    <h2>Sélection</h2>

                    <SelectField form={FORM} name="brand" label="Marque" required
                        behaviors={[brandOptions]}
                        hint="Options chargées en API au montage" />

                    <SelectField form={FORM} name="model" label="Modèle" required
                        behaviors={[modelOptions]}
                        hint="Dépend de `brand` : rechargé et vidé à chaque changement" />

                    <TextField form={FORM} name="otherBrand" label="Précisez la marque"
                        behaviors={[onlyWhenBrandIsOther]}
                        hint="Piloté par le flag `invisible`" />

                    <RadioField form={FORM} name="fuel" label="Motorisation" required
                        options={FUEL_OPTIONS} />

                    <MultiSelectField form={FORM} name="packs" label="Options"
                        behaviors={[packOptions]}
                        validator={new SelectionCountValidator(2)}
                        hint="Valeur `string[]` — 2 maximum" />
                </section>

                <section className="panel">
                    <h2>Nombre, dates, fichier</h2>

                    <NumberField form={FORM} name="mileage" label="Kilométrage" required
                        min={0} max={300000} step={1000}
                        validator={new NumberRangeValidator(0, 300000)}
                        hint="Valeur `number`" />

                    <CheckboxField form={FORM} name="consent" label="J'accepte les conditions"
                        validator={new ConsentValidator()}
                        hint="Valeur `boolean` — débloque la date de livraison" />

                    <DateField form={FORM} name="deliveryDate" label="Date de livraison" kind="date" required
                        validator={new NotInThePastValidator()}
                        behaviors={[lockedUntilConsent]}
                        hint="Verrouillé tant que les conditions ne sont pas acceptées" />

                    <DateField form={FORM} name="deliverySlot" label="Créneau" kind="time"
                        validator={new TimeWindowValidator(8, 19)}
                        hint="Entre 08:00 et 19:00" />

                    <DateField form={FORM} name="inspectionAt" label="Rendez-vous contrôle" kind="datetime-local"
                        validator={new NotInThePastValidator()} />

                    <FileField form={FORM} name="licence" label="Permis de conduire" required
                        accept="image/png,image/jpeg"
                        validator={new FileValidator(512 * 1024, ["image/png", "image/jpeg"])}
                        hint="Valeur `File` — PNG/JPEG, 512 Ko max" />
                </section>
            </form>

            <FormActions />

            <DebugOverlay title="État du formulaire — slz-form">
                <FormDebug />
            </DebugOverlay>
        </>
    );
}
