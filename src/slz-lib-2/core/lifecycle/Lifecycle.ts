export class LifeCycle {
    private mounted = false;
    private unsubscribe?: () => void;

    constructor(params: {
        run: () => void,
    }) {

    }
    
    public mount(
        subscribe?: () => void,
    ): void {
        if (this.mounted) {
            return;
        }
        this.mounted = true;
        this.unsubscribe = () => subscribe?.()
    }
}