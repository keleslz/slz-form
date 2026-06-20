import { Stack, Typography } from "@mui/material";
import { FORM_2 } from "../../../../redux";
import { TextField } from "../../../../component/text-field";
import { useMemo } from "react";
import { UsernameValidator } from "../../../../validator/UsernameValidator";
import { CustomPhoneBehavior } from "../car-configuration-form/CustomPhoneBehiavior";
import { PhoneValidator } from "../../../../validator/PhoneValidator";
import { DebouncedValidator, DelayedValidator } from "../../../../slz-lib/core";

export function AnotherForm() {
    const nameValidator = useMemo(() => new UsernameValidator(), []);
    const customPhoneBehaviors = useMemo(() => [new CustomPhoneBehavior()], []);
    const phoneValidator = useMemo(
        () => new DebouncedValidator(new DelayedValidator(new PhoneValidator(), 2000), 500),
        [],
    );
    return <Stack spacing={2}>
        <Typography variant='h6'>Another Form</Typography>
        <Typography variant='body1'>(asynchronous form form)</Typography>
        <TextField
            formId={FORM_2.id}
            name='name'
            label='Name'
            placeholder='Enter your name' value='test 2'
            validator={nameValidator}
        />
        <TextField
            formId={FORM_2.id}
            name='phone'
            label='Phone'
            placeholder='Enter your phone'
            validator={phoneValidator}
            behaviors={customPhoneBehaviors}
        />
    </Stack>
}   