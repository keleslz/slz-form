import { delay } from "../delay";

/** Prefills the customer reference from the account. */
export function fetchCustomerReference(): Promise<string> {
    return delay("CUST-42-9013", 900);
}
