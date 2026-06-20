import { createAsyncThunk } from "@reduxjs/toolkit";
import { formSlice } from "../form";
import { CAR_CONFIGURATION_FORM } from "../form/car-configuration-form";

export const createCarThunk = createAsyncThunk(
    "car/create",
    async (_, { dispatch }) => {
        dispatch(formSlice.actions.submitting({ formId: CAR_CONFIGURATION_FORM.id }));
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const response = Math.random() > 0.5 ? { id: 1, make: "Toyota", model: "Corolla" } : new Error("Failed to create car"); // Simulate success or failure
            if (response instanceof Error) {
                throw response;
            }
            dispatch(formSlice.actions.submitted({ formId: CAR_CONFIGURATION_FORM.id }));
        } catch {
            // Trigger your global ui error handling here, e.g. using a toast notification
            // dispatch(formSlice.actions.submissionFailed({ formId: FORM_1.id }));  
            dispatch(formSlice.actions.error({ formId: CAR_CONFIGURATION_FORM.id }));
        }
    });