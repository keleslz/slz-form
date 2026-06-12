import { useCallback } from "react";
import type { UseBehaviorProps } from "./props";

export function useBehavior(props: UseBehaviorProps) {
    return useCallback(() => {
        const behaviors = Array.isArray(props) ? props : [props];
        return behaviors;
    }, [props]);
}