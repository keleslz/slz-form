import type { Rule } from "./rule";

export function validateTimeWindow(fromHour: number, toHour: number): Rule<string> {
    return (value) => {
        const [hours] = value.split(":").map(Number);
        return hours < fromHour || hours >= toHour
            ? `Créneau entre ${String(fromHour).padStart(2, "0")}:00 et ${toHour}:00`
            : null;
    };
}
