import { FormController } from "slz-form";

/**
 * A form of the consuming app, in its own contextual module — the counterpart
 * of a slice.
 *
 * It declares the form's identity and nothing else: fields join it when the
 * view renders them, so adding an input never touches this file.
 */
export const CAR_CONFIGURATION_FORM = "car-configuration";

export const carConfigurationForm = new FormController({ name: CAR_CONFIGURATION_FORM });
