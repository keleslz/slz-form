import { fetchCustomerReference } from "../../api/fetch-customer-reference";
import { prefill } from "../car-configuration-form";

/** Rempli depuis l'API au montage, verrouillé pendant l'appel, reste `pristine`. */
export const customerReferencePrefill = prefill({
    field: "customerReference",
    fetch: () => fetchCustomerReference(),
});
