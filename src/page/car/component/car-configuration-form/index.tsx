import { Stack, Typography } from "@mui/material";
import { TextField } from "../../../../component/text-field";
import { CAR_CONFIGURATION_FORM } from "../../../../redux/form/car-configuration-form";
import { RedirectOnFormStatusChange } from "../../../../slz-lib";

export function CarConfigurationForm() {
    /**
     * Configurez vote
     * Model
     */
    return <Stack spacing={2}>
        <Typography variant='h6'>Configurez votre véhicule</Typography>
        
        <TextField
            formId={CAR_CONFIGURATION_FORM.id}
            name='name'
            label=''
        />

        <RedirectOnFormStatusChange
            formId={CAR_CONFIGURATION_FORM.id}
            to='/?success=true'
            eventType='submitted'
        />
    </Stack>
}   