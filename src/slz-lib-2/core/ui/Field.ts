import type { BehaviorContext, IBehavior } from "../behavior";
import type { StateFlags } from "../state";
import type { StateSnapshot } from "../state/StateSnapshot";
import type { IValidator } from "../validator";
import type { FieldParams } from "./FieldParams";
import type { FieldValue } from "./FieldValue";

type Listener = () => void;

/**
 * Owns the per-field state (value, interactions, flags, validator) and exposes
 * an observable snapshot. It holds *state* only — running the behavior lifecycle
 * is the `Controller`'s job, which mutates the field through these methods and
 * reads back `snapshot`.
 */
export class Field {
    private readonly name: string
    private readonly behaviorsFlags = new Map<IBehavior, StateFlags>();
    private readonly behaviors = new Set<IBehavior>()
    private readonly listeners = new Set<Listener>();
    private readonly _required?: boolean
    private _value?: FieldValue
    private _validator?: IValidator;
    private _snapshot: StateSnapshot;

    private touched = false;
    private focused = false;

    constructor(params: FieldParams) {
        this.name = params.name;
        this._value = params.initialValue;
        this._required = params.required;
        this.focused = params.focused ?? false;
        this._snapshot = this.buildSnapshot();
    }

    // ── observable surface ───────────────────────────────────────────────
    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    public emit(): void {
        for (const listener of this.listeners) listener();
    }

    public get snapshot() {
        return this._snapshot;
    }

    // ── value / interactions ─────────────────────────────────────────────
    public get value() {
        return this._value
    }

    public setValue(next?: FieldValue) {
        this._value = next;
    }

    public get required() {
        return this._required;
    }

    public get isTouched() {
        return this.touched;
    }

    public get isFocused() {
        return this.focused;
    }

    public focus() {
        this.touch()
        this.focused = true
    }

    public blur() {
        this.focused = false
    }

    public touch() {
        this.touched = true;
    }

    // ── behaviors / validator wiring ─────────────────────────────────────
    public addBehavior(behavior: IBehavior) {
        this.behaviors.add(behavior)
        this.behaviorsFlags.set(behavior, [])
    }

    public getBehaviors() {
        return Array.from(this.behaviors)
    }

    public setFlags(behavior: IBehavior, flags: StateFlags) {
        this.behaviorsFlags.set(behavior, flags);
        this.rebuildSnapshot();
    }

    public getFlags() {
        return Array.from(new Set([...this.behaviorsFlags.values()].flat()));
    }

    public addValidator(value: IValidator) {
        this._validator = value
    }

    public get validator() {
        return this._validator
    }

    public hasError() {
        return this._validator?.hasError
    }

    // ── behavior context ─────────────────────────────────────────────────
    public buildContext(behavior: IBehavior): BehaviorContext {
        return {
            name: this.name,
            validator: this._validator,
            touched: this.touched,
            getName: () => this.name,
            getValue: () => this._value,
            setValue: (v) => { this._value = v; },
            pushFlags: (flags) => {
                this.behaviorsFlags.set(behavior, flags);
                this.rebuildSnapshot();
                this.emit();
            },
        };
    }

    // ── snapshot ─────────────────────────────────────────────────────────
    public rebuildSnapshot() {
        this._snapshot = this.buildSnapshot();
    }

    private buildSnapshot(): StateSnapshot {
        return {
            name: this.name,
            value: this._value,
            flags: this.getFlags(),
            interactions: {
                focused: this.focused,
                touched: this.touched,
            },
            validatorState: this._validator?.getState(),
        };
    }
}
