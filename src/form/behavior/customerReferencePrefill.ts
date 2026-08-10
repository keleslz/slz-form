import { fetchCustomerReference } from "../../api/fetch-customer-reference";
import { prefill } from "../../slz-lib-v5/core";

/** Fills from the API, locked and loading meanwhile, without marking the field touched. */
export const customerReferencePrefill = prefill(fetchCustomerReference);
