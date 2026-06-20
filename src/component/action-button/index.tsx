import { useAppSelector } from "../../redux";
import { CAR_CONFIGURATION_FORM } from "../../redux/form/car-configuration-form";
import type { ActionButtonProps } from "./props";

// Component required to show the form status and prevent multiple re-renders while input typed or submitted
export function ActionButton(props: ActionButtonProps) { 
    const form = useAppSelector((state) => state.form[CAR_CONFIGURATION_FORM.id]);
    if(!form) {
        return null
    }
    
    const status = form.status === "submitting"
    return (
        <button disabled={status} onClick={props.onClick}>{props.label}</button>
    )
}