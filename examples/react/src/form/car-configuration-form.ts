import { behaviorsFor, FormController, type Field } from "slz-form";
import { hooksFor } from "slz-react-form";

/** Ce que renvoie l'API des marques, conservé sur l'option. */
export interface BrandRecord {
    readonly id: string;
    readonly name: string;
    readonly country: string;
}

/**
 * Un formulaire de l'application, dans son module contextualisé — le pendant
 * d'une slice.
 *
 * La map déclare ce que vaut chaque champ. C'est le prix du narrowing : ajouter
 * un champ coûte une ligne ici et une dans la vue, au lieu d'une seule. En
 * échange, plus aucun `as` côté consommateur et un nom fautif ne compile pas.
 */
export const CAR_CONFIGURATION_FORM = "car-configuration";

/**
 * Un `type` et non une `interface` : seule la première porte la signature
 * d'index implicite qu'attend la contrainte `FieldsShape` du moteur.
 */
export type CarFields = {
    fullName: string;
    email: string;
    plate: string;
    customerReference: string;
    comment: string;
    username: string;
    postcode: string;
    city: string;
    citySearch: string;
    brand: Field<string, BrandRecord>;
    model: string;
    otherBrand: string;
    fuel: string;
    packs: string[];
    mileage: number;
    consent: boolean;
    deliveryDate: string;
    deliverySlot: string;
    inspectionAt: string;
    licence: File;
};

export const carConfigurationForm = new FormController<CarFields>({ name: CAR_CONFIGURATION_FORM });

/** Behaviors et hooks liés à ce formulaire : tout est inféré derrière. */
export const { lookup, loadOptions, suggest, prefill, lockWhile, hideWhen } =
    behaviorsFor(carConfigurationForm);

export const { useField, useForm } = hooksFor(carConfigurationForm);
