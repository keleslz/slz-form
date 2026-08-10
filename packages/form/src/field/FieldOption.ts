/**
 * Options are a first-class dimension of a field, not free-form data.
 *
 * Select / multi-select / radio need them, and "fetch my options" is by far the
 * most common async need — giving it a typed slot avoids a generic `data` bag
 * that would turn the snapshot into a junk drawer (invariant 21).
 */
export interface FieldOption<V = string> {
    readonly value: V;
    readonly label: string;
    readonly disabled?: boolean;
}
