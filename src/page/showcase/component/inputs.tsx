import type { FieldOption, IBehavior, IValidator } from "../../../slz-lib-v5/core";
import { useField } from "../../../slz-lib-v5/react";
import { FieldShell } from "./FieldShell";

/** Demo-wide default; any field can override it via `requiredMessage`. */
const REQUIRED_MESSAGE = "Champ obligatoire";

/**
 * One component per input type. Every one of them is the same three lines:
 * call `useField`, bail out on `invisible`, render from the flags.
 *
 * None of them holds state — no `useState` mirrors the controller (invariant 3).
 */
export interface BaseFieldProps<T> {
    form: string;
    name: string;
    label: string;
    hint?: string;
    required?: boolean;
    requiredMessage?: string;
    initialValue?: T;
    validator?: IValidator<T>;
    behaviors?: readonly IBehavior<T>[];
    /** Static list; a behavior publishes them instead when they come from an API. */
    options?: readonly FieldOption[];
}

type TextKind = "text" | "email" | "tel" | "password";
type DateKind = "date" | "time" | "datetime-local";

export function TextField(props: BaseFieldProps<string> & { kind?: TextKind; placeholder?: string }) {
    const { label, hint, kind = "text", placeholder, ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <input
                type={kind}
                value={field.value ?? ""}
                placeholder={placeholder}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.value)}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}

export function TextAreaField(props: BaseFieldProps<string> & { rows?: number }) {
    const { label, hint, rows = 3, ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <textarea
                rows={rows}
                value={field.value ?? ""}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.value)}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}

export function NumberField(props: BaseFieldProps<number> & { min?: number; max?: number; step?: number }) {
    const { label, hint, min, max, step, ...params } = props;
    const field = useField<number>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={field.value ?? ""}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}

export function DateField(props: BaseFieldProps<string> & { kind: DateKind }) {
    const { label, hint, kind, ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <input
                type={kind}
                value={field.value ?? ""}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.value)}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}

export function SelectField(props: BaseFieldProps<string> & { placeholder?: string }) {
    const { label, hint, placeholder = "—", ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <select
                value={field.value ?? ""}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.value || undefined)}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            >
                <option value="">{placeholder}</option>
                {field.options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldShell>
    );
}

export function MultiSelectField(props: BaseFieldProps<string[]>) {
    const { label, hint, ...params } = props;
    const field = useField<string[]>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    const selected = field.value ?? [];

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <select
                multiple
                size={4}
                value={selected}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(
                    Array.from(event.target.selectedOptions, (option) => option.value),
                )}
                onFocus={field.onFocus}
                onBlur={field.onBlur}
            >
                {field.options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldShell>
    );
}

export function RadioField(props: BaseFieldProps<string>) {
    const { label, hint, ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <div className="radio-group">
                {field.options.map((option) => (
                    <label key={option.value} className="radio">
                        <input
                            type="radio"
                            name={field.name}
                            value={option.value}
                            checked={field.value === option.value}
                            disabled={field.isLocked || option.disabled}
                            onChange={() => field.onChange(option.value)}
                            onBlur={field.onBlur}
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </FieldShell>
    );
}

export function CheckboxField(props: BaseFieldProps<boolean>) {
    const { label, hint, ...params } = props;
    const field = useField<boolean>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <input
                type="checkbox"
                checked={field.value ?? false}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}

export function FileField(props: BaseFieldProps<File> & { accept?: string }) {
    const { label, hint, accept, ...params } = props;
    const field = useField<File>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            label={label}
            hint={hint}
            required={field.required}
            showError={field.showError}
            error={field.error}
            isLoading={field.isLoading}
            flags={field.flags}
        >
            <input
                type="file"
                accept={accept}
                disabled={field.isLocked}
                onChange={(event) => field.onChange(event.target.files?.[0])}
                onBlur={field.onBlur}
            />
        </FieldShell>
    );
}
