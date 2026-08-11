import {
    brandOptions,
    cityFromPostcode,
    citySuggestions,
    customerReferencePrefill,
    lockedUntilConsent,
    modelOptions,
    onlyWhenBrandIsOther,
    packOptions,
} from "../../form/behavior";
import { DebouncedValidator } from "slz-form";
import {
    ConsentValidator,
    EmailValidator,
    FileValidator,
    NotInThePastValidator,
    NumberRangeValidator,
    PlateValidator,
    SelectionCountValidator,
    TimeWindowValidator,
    UsernameValidator,
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


/**
 * Chaque champ déclare ce qu'il est et ce qu'on lui branche. Ni état, ni effet,
 * ni orchestration dans ce fichier — le moteur porte tout.
 *
 * Plus de `form=` non plus : les hooks sont liés au formulaire, et `name` est
 * contraint aux champs déclarés — et à ceux du bon type. `<NumberField
 * name="email" />` ne compile pas.
 */
export function SlzCarForm() {
    return (
        <>
            <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
                <section className="panel">
                    <h2>Texte</h2>

                    <TextField name="fullName" label="Nom complet" required
                        placeholder="Ada Lovelace" />

                    <TextField name="email" label="Email" kind="email" required
                        validator={new EmailValidator()}
                        hint="Validation synchrone" />

                    <TextField name="plate" label="Plaque d'immatriculation" required
                        validator={new PlateValidator()}
                        hint="Validation asynchrone — flag `loading` pendant l'appel" />

                    <TextField name="customerReference" label="Référence client"
                        behaviors={[customerReferencePrefill]}
                        hint="Prefill API : verrouillé et `loading`, reste `pristine`" />

                    <TextAreaField name="comment" label="Commentaire" rows={3} />
                </section>

                <section className="panel">
                    <h2>Asynchrone différé</h2>

                    <TextField name="username" label="Identifiant" required
                        validator={new DebouncedValidator(new UsernameValidator(), 400)}
                        placeholder="ada, grace et alan sont pris"
                        hint="Validation async différée : une salve de frappe = un seul appel API" />

                    <TextField name="postcode" label="Code postal"
                        placeholder="75001, 69001, 13001, 33000"
                        hint="Déclencheur du lookup ci-dessous" />

                    <TextField name="city" label="Ville"
                        behaviors={[cityFromPostcode]}
                        hint="Behavior async qui **écrit** : verrouillé pendant l'appel pour ne pas écraser la saisie" />

                    <TextField name="citySearch" label="Recherche de ville" suggest
                        behaviors={[citySuggestions]}
                        placeholder="tapez au moins 2 lettres"
                        hint="Champ de recherche : `loading` sans `locked`, la frappe n'est jamais interrompue" />
                </section>

                <section className="panel">
                    <h2>Sélection</h2>

                    <SelectField name="brand" label="Marque" required
                        behaviors={[brandOptions]}
                        hint="Options chargées en API au montage" />

                    <SelectField name="model" label="Modèle" required
                        behaviors={[modelOptions]}
                        hint="Dépend de `brand` : rechargé et vidé à chaque changement" />

                    <TextField name="otherBrand" label="Précisez la marque"
                        behaviors={[onlyWhenBrandIsOther]}
                        hint="Piloté par le flag `invisible`" />

                    <RadioField name="fuel" label="Motorisation" required
                        options={FUEL_OPTIONS} />

                    <MultiSelectField name="packs" label="Options"
                        behaviors={[packOptions]}
                        validator={new SelectionCountValidator(2)}
                        hint="Valeur `string[]` — 2 maximum" />
                </section>

                <section className="panel">
                    <h2>Nombre, dates, fichier</h2>

                    <NumberField name="mileage" label="Kilométrage" required
                        min={0} max={300000} step={1000}
                        validator={new NumberRangeValidator(0, 300000)}
                        hint="Valeur `number`" />

                    <CheckboxField name="consent" label="J'accepte les conditions"
                        validator={new ConsentValidator()}
                        hint="Valeur `boolean` — débloque la date de livraison" />

                    <DateField name="deliveryDate" label="Date de livraison" kind="date" required
                        validator={new NotInThePastValidator()}
                        behaviors={[lockedUntilConsent]}
                        hint="Verrouillé tant que les conditions ne sont pas acceptées" />

                    <DateField name="deliverySlot" label="Créneau" kind="time"
                        validator={new TimeWindowValidator(8, 19)}
                        hint="Entre 08:00 et 19:00" />

                    <DateField name="inspectionAt" label="Rendez-vous contrôle" kind="datetime-local"
                        validator={new NotInThePastValidator()} />

                    <FileField name="licence" label="Permis de conduire" required
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
