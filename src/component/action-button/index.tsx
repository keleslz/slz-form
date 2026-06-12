import { FORM_1, useAppSelector } from "../../redux";
import type { ActionButtonProps } from "./props";

// Component required to show the form status and prevent multiple re-renders while input typed or submitted
export function ActionButton(props: ActionButtonProps) { 
    const form = useAppSelector((state) => state.form[FORM_1.id]);
    if(!form) {
        return null
    }
    
    const status = form.status === "submitting"
    return (
        <button disabled={status} onClick={props.onClick}>{props.label}</button>
    )
}