import type { FieldOption, IBehavior, IValidator } from "../../../slz-lib-v5/core";

/** Everything a field needs: a name, and optionally what to plug into it. */
export interface SlzFieldProps<T> {
    form: string;
    name: string;
    label: string;
    hint?: string;
    required?: boolean;
    requiredMessage?: string;
    initialValue?: T;
    validator?: IValidator<T>;
    behaviors?: readonly IBehavior<T>[];
    options?: readonly FieldOption[];
}

export const REQUIRED_MESSAGE = "Champ obligatoire";

/** Render-counter key, scoped to this tab so it never collides with the baseline. */
export const shellId = (name: string) => `slz:${name}`;
