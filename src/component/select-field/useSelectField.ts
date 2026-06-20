import { useMemo, useState } from "react";
import { useField } from "../../slz-lib";
import type { SelectFieldProps, SelectOption } from "./props";
import { lockedFetchBehavior } from "../../slz-lib/core";

/**
 * Select-specific wrapper around `useField`. Owns the async options state,
 * builds the internal `lockedFetchBehavior` for fetching + default selection,
 * and exposes a flat, view-ready shape for `SelectField`.
 *
 * Keeps `SelectField` purely presentational.
 */
export function useSelectField(props: SelectFieldProps) {
    const { validator, behaviors = [], optionsFetcher, defaultValue } = props;

    // Local options state: confined to the component instance, no parent
    // re-render when the fetch resolves.
    const [options, setOptions] = useState<SelectOption[]>(props.options ?? []);

    // Append an internal lockedFetchBehavior when a fetcher is provided.
    // Controller is memoized by formId+fieldId in `useField`, so the array
    // identity doesn't matter on re-renders.
    const allBehaviors = useMemo(() => {
        if (!optionsFetcher) return behaviors;
        return [
            ...behaviors,
            lockedFetchBehavior(async (ctx) => {
                const fetched = await optionsFetcher(ctx.signal);
                if (ctx.signal.aborted) return;
                setOptions(fetched);
                if (defaultValue !== undefined && fetched.some(o => o.value === defaultValue)) {
                    ctx.setValue(defaultValue);
                }
            }),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [optionsFetcher, defaultValue]);

    const base = useField({
        formId: props.formId,
        fieldId: props.name,
        name: props.name,
        validator,
        behaviors: allBehaviors,
        value: props.value,
        required: props.required,
    });

    return { ...base, options };
}
