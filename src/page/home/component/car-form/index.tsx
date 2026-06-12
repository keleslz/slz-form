import { Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { TextField } from "../../../../component/text-field";
import { RequiredValidator } from "../../../../validator/RequiredValidator";
import { FORM_1 } from "../../../../redux";
import {
    DefaultBehavior,
    useBehavior,
    dependantBehavior,
} from "../../../../slz-lib";

export function CarForm() {
    // ── INTER-FIELD DEPENDENCY ─────────────────────────────────────────────
    // One shared `dependantBehavior` instance is passed to both fields.
    // When one changes, the sibling gets a 1s "loading" flash.
    const linked = useMemo(() => dependantBehavior(), []);
    const linkedBehaviors = useBehavior([new DefaultBehavior(), linked]);

    return (
        <div>
            <Stack spacing={2}>
                <Typography variant="h6">Car Form</Typography>

                <TextField
                    formId={FORM_1.id}
                    name="cardType"
                    label="CardType"
                    validator={new RequiredValidator()}
                    behaviors={linkedBehaviors()}
                />

                 <TextField
                    formId={FORM_1.id}
                    name="cardTypeDefault"
                    label="CardTypeDefault"
                    validator={new RequiredValidator()}
                    behaviors={linkedBehaviors()}
                />
                {/* <Typography variant="body2">1. Synchronous validation</Typography>
                <TextField
                    formId={FORM_1.id}
                    name="name"
                    label="Username (sync)"
                    placeholder="3 to 5 chars"
                    validator={usernameValidator}
                    behaviors={usernameBehaviors()}
                    required
                /> */}

                {/* <Typography variant="body2">2. Asynchronous validation (1s fake API)</Typography>
                <TextField
                    formId={FORM_1.id}
                    name="email"
                    label="Email (async)"
                    placeholder="must contain @"
                    validator={emailValidator}
                    behaviors={emailBehaviors}
                    required
                />

                <Typography variant="body2">
                    3. Async + debounce + lock while loading
                </Typography>
                <TextField
                    formId={FORM_1.id}
                    name="emailDebounced"
                    label="Email (debounced + locked)"
                    placeholder="type, wait ~1.5s"
                    validator={debouncedValidator}
                    behaviors={debouncedBehaviors}
                    required
                />

                <Typography variant="body2">
                    4. Prefill from fake API on mount
                </Typography>
                <TextField
                    formId={FORM_1.id}
                    name="prefill"
                    label="Prefilled email"
                    placeholder="waiting for API…"
                    validator={prefillValidator}
                    behaviors={prefillBehaviors()}
                    required
                />

                <Typography variant="body2">
                    5. Select with async-fetched options
                </Typography>
                <SelectField
                    formId={FORM_1.id}
                    name="cardType"
                    label="Card type"
                    optionsFetcher={fakeFetchOptions}
                    validator={cardValidator}
                    behaviors={cardBehaviors}
                    required
                />

                <Typography variant="body2">
                    6. Same as 5, with a default value pre-selected after fetch
                </Typography>
                <SelectField
                    formId={FORM_1.id}
                    name="cardTypeDefault"
                    label="Card type (default: Mastercard)"
                    optionsFetcher={fakeFetchOptions}
                    defaultValue="mastercard"
                    validator={cardValidator}
                    behaviors={cardBehaviors}
                    required
                /> */}
            </Stack>
        </div>
    );
}
