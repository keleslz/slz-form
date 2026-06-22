import { useAppSelector } from "../../../../redux";
import type { RedirectOnStatusChangeProps } from "./props";
import { redirect } from 'react-router'

export function RedirectOnFormStatusChange(props: RedirectOnStatusChangeProps) {
    const form = useAppSelector(state => state.forms[props.formId]);

    if (form && form.status.value === props.eventType) {
        /** Raw path for simplicity, in a real app you would  be more secure **/
        redirect(props.to)
    }

    return null;
}