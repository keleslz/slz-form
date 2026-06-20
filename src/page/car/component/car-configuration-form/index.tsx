import { Stack, Typography } from "@mui/material";
import { CAR_CONFIGURATION_FORM } from "../../../../redux/form/car-configuration-form";
import { RedirectOnFormStatusChange } from "../../../../slz-lib";
import { TextFieldV2 } from "../../../../component/text-field-v2";

export function CarConfigurationForm() {
    /**
     * Configurez vote
     * Model
     */
    return <Stack spacing={2}>
        <Typography variant='h6'>Configurez votre véhicule</Typography>
        
        <TextFieldV2
            formId={CAR_CONFIGURATION_FORM.id}
            name='name'
            label='Versions'
        />

        <RedirectOnFormStatusChange
            formId={CAR_CONFIGURATION_FORM.id}
            to='/?success=true'
            eventType='submitted'
        />
    </Stack>
}   