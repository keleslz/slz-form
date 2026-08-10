import { createContext, useContext } from "react";
import type { FormRegister } from "slz-form";

export const RegisterContext = createContext<FormRegister | null>(null);

export function useFormRegister(): FormRegister {
    const register = useContext(RegisterContext);
    if (!register) {
        throw new Error("[slz] `useFormRegister` must be used inside a <FormProvider>.");
    }
    return register;
}
