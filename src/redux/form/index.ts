import { createFormSlice } from "../../slz-lib/react-core";
import type { CarConfigurationFormFields, CarConfigurationFormId } from "./car-configuration-form";

export type FormStateId = CarConfigurationFormId
export type FieldStateId = CarConfigurationFormFields
export const formSlice = createFormSlice<FormStateId, FieldStateId>("form");
export const formReducer = formSlice.reducer;