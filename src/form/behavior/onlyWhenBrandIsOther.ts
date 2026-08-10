import { hideWhen } from "../../slz-lib-v5/core";

/** Emits `invisible`: the view stops rendering the input by reading the flag. */
export const onlyWhenBrandIsOther = hideWhen(
    ["brand"],
    (form) => form.field("brand")?.value !== "other",
);
