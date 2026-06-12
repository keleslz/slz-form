import { useAppSelector } from "../../../../redux";
import type { RedirectOnStatusChangeProps } from "./props";

export function RedirectOnFormStatusChange(props: RedirectOnStatusChangeProps) {
    const form = useAppSelector(state => state.form[props.formId]);

    if (form && form.status.value === props.eventType) {
        /** Raw path for simplicity, in a real app you would  be more secure **/
        window.location.href = props.to;
    }

    return null;
}