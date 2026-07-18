import { useAppSelector, type FieldStateId, type FormStateId } from "../../../redux";

type UseFieldProps = {
    formId: FormStateId;
    fieldId: FieldStateId;
}
export function useFieldSelector(props: UseFieldProps) {
    return useAppSelector((s) => s.forms[props.formId]?.fields[props.fieldId]);
}