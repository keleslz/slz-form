import type { ReactNode } from "react";
import type { FormRegister } from "slz-form";
import { RegisterContext } from "./registerContext";

export interface FormProviderProps {
    register: FormRegister;
    children: ReactNode;
}

/**
 * Publishes the app's FormRegister to the tree — the exact counterpart of
 * react-redux's `<Provider store={store}>`.
 *
 * This is what lets a view address a form by name instead of importing the
 * instance: components stay free of `new FormController(...)`.
 */
export function FormProvider({ register, children }: FormProviderProps) {
    return <RegisterContext.Provider value={register}>{children}</RegisterContext.Provider>;
}
