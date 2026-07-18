export class LifeCycle {
    private _mounted = false;

    public mount() {
        if (this._mounted) {
            return;
        }
        this._mounted = true;
        // if (value !== undefined) {
        //     this.field.setValue(value);
        // }
    }
    public unmount() {
        if (!this._mounted) {
            return;
        }
        this._mounted = false;
        // this.unsubscribeValidator?.();
        // this.unsubscribeValidator = undefined;
        // for (const behavior of this.field.getBehaviors()) {
        //     behavior.onUnmount?.(this.field.buildContext(behavior))
        // }
    }

    public get mounted() {
        return this._mounted
    }
}