import { Button } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../redux";
import { hasFieldError } from "../../slz-lib/form-core/util/hasFieldError";
import type { SubmitButtonProps } from "./props";
import { createCarThunk } from "../../redux/car/thunk";

export function SubmitButton(props: SubmitButtonProps) {
    const formId = props.formId;
    const dispatch = useAppDispatch();
    const form = useAppSelector((state) => state.form[formId]);

    if (!form) {
        return null
    }

    return <Button
        variant="contained"
        color="primary"
        type="submit"
        onClick={() => dispatch(createCarThunk())}
        disabled={hasFieldError(form) || form.status === "submitting"}
        loading={form.status === "submitting"}
    >
        Submit
    </Button>
}