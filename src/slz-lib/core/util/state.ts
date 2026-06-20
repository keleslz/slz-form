export type FormId<Fo extends string> = Fo extends string ? Fo : never;
export type FieldId<Fi extends string> = Fi extends string ? Fi : never;

export type FormState<Fo extends FormId<string>, Fi extends FieldId<string>> = Record<Fo, FormStateItem<Fo, Fi>>;

export type FormStateItem<Fo extends FormId<string>, Fi extends FieldId<string>> = {
    id: Fo;
    name: string;
    status: { value: "idle" |  "submitting" | "submitted" } | { value: "error", errors: string[] };
    fields: Record<Fi, FieldState<Fi>>
}

export interface FieldState<Fi extends FieldId<string>> {
    status: { value: "idle" } | { value: "valid" } | { value: "error", errors: string[] };
    id: Fi
    value: string
}