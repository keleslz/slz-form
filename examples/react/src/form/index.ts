import { FormRegister } from "slz-form";
import { carConfigurationForm } from "./car-configuration-form";

export * from "./car-configuration-form";

/**
 * Every form of the app, gathered once — the counterpart of the root reducer.
 *
 * This file is the answer to "what forms does my app have?". Views never import
 * a FormController: they name one, and the register resolves it.
 */
export const formRegister = new FormRegister({
    values: [
        carConfigurationForm,
    ],
});
