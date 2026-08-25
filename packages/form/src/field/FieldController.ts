import {
    watchedName,
    watchedTriggers,
    type BehaviorContext,
    type BehaviorHook,
    type BehaviorResult,
    type FieldChanges,
    type IBehavior,
} from "../behavior";
import { Lifecycle } from "../lifecycle";
import { BehaviorState, UiState } from "../state";
import type { AnyUiFlag, ValidityFlag } from "../state";
import {
    CompositeValidator,
    DebouncedValidator,
    DefaultValidator,
    type IValidator,
    type ValidationContext,
    type ValidatorStatus,
} from "../validator";
import type { FormView } from "../form/FormView";
import type { FieldHost } from "./FieldHost";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";
import { FieldSnapshot } from "./FieldSnapshot";
import type { AnyFieldView, FieldView } from "./FieldView";

type Listener = () => void;

/**
 * Une passe d'un behavior : un appel de hook, et ce que valait sa tranche
 * **juste avant** cet appel.
 *
 * La référence appartient à la passe. C'est ce qui rend la restitution
 * univoque : `release` rend la passe qu'on lui donne, sans avoir à deviner
 * laquelle d'un état partagé était la bonne.
 */
interface Pass {
    readonly before: BehaviorState;
    readonly generation: number;
    /**
     * Personne ne viendra la refermer en retombant : c'est le retour à `idle`
     * qui s'en charge.
     *
     * Deux cas. Une écriture hors hook — le `ctx.push` d'un behavior abonné à
     * une source externe — et un hook **synchrone** qui allume `loading` sans
     * rendre de promesse : lui non plus n'a rien qui retombera.
     */
    detached: boolean;
    /**
     * Cette passe **détient** l'attente en cours : c'est elle qui a allumé
     * `loading`.
     *
     * Une passe ouverte n'est pas une passe qui travaille. Compter les passes
     * pour savoir si une sœur est encore en vol faisait publier à `release` un
     * `loading` que personne n'éteindrait — le champ restait occupé à vie, et
     * toute soumission partait pour `settleTimeout`.
     */
    owned: boolean;
}

/**
 * Quel champ possède quel validator. Une `WeakMap` : elle ne retient rien et ne
 * pèse pas sur la durée de vie des instances.
 */
const OWNERS = new WeakMap<object, string>();

export interface FieldParams<T = string, M = never> {
    name: string;
    required?: boolean;
    /** Overrides the validator's default "required" message. */
    requiredMessage?: string;
    /** Traite `false` comme vide — pour une case à cocher qui doit être cochée. */
    requiredTrue?: boolean;
    initialValue?: T;
    /**
     * Un validator, ou plusieurs. Un tableau est enveloppé dans un
     * `CompositeValidator` : chaque membre garde ses règles, leurs constats sont
     * agrégés, et la validité reste décidée par un validator (invariant 13).
     */
    validator?: IValidator<T> | readonly IValidator<T>[];
    behaviors?: readonly IBehavior<T, M>[];
    options?: readonly FieldOption<OptionValue<T>, M>[];
}

/** Props the consumer can push after creation. Identity (name, behaviors, validator) is fixed. */
export interface FieldUpdate<T = string, M = never> {
    required?: boolean;
    value?: T;
    options?: readonly FieldOption<OptionValue<T>, M>[];
    /** Verrouillage décidé par la vue, cumulé avec celui des behaviors. */
    locked?: boolean;
    /** Lecture seule décidée par la vue, cumulée avec celle des behaviors. */
    readOnly?: boolean;
}

/**
 * Owns one input: its value, its interactions, its behaviors' slices and its
 * validator. Source of truth for that field and for nothing else (invariants 2,
 * 5, 6) — it can read the form, never write to another field.
 *
 * Configuration is a single object; everything beyond `name` is optional
 * (invariant 17).
 */
export class FieldController<T = string, M = never> {
    readonly name: string;

    private readonly lifecycle = new Lifecycle();
    private readonly behaviors: readonly IBehavior<T, M>[];
    private readonly validator: IValidator<T>;
    private readonly statesByBehavior = new Map<IBehavior<T, M>, BehaviorState>();
    /**
     * La tranche de chaque behavior **avant l'appel de son hook**.
     *
     * C'est la référence dont `release` se sert quand la passe échoue : pas
     * `neutral`, qui effacerait aussi ce qu'il avait posé hors de l'attente — un
     * fait permanent émis au montage, que personne ne remettrait puisque
     * `onMount` n'est pas rejoué.
     *
     * **Avant le hook**, et non avant le passage à `loading` : une passe entre
     * en attente dès que son hook rend une promesse, qu'elle publie `loading`
     * ou non. S'indexer sur `loading` ratait tout behavior qui pousse un état
     * sans lui — à commencer par le skeleton de `parity.test.ts`, dont le
     * masquage restait alors collé après un échec.
     */
    /**
     * Les passes **ouvertes** de chaque behavior, dans l'ordre où elles se sont
     * ouvertes. Chacune porte son propre état d'entrée.
     *
     * La référence appartient à la passe, pas au behavior. Une map partagée
     * avait deux auteurs — le hook et l'écriture d'un `loading` — arbitrés par
     * un « premier arrivé, premier servi », et deux comptabilités qui pouvaient
     * se contredire : c'est de ces contradictions que sortaient les trois
     * dernières régressions.
     */
    private readonly openPasses = new Map<IBehavior<T, M>, Pass[]>();
    /**
     * Génération de passe, **par behavior**. `reset()` les supplante tous ;
     * `recover()` ne supplante que ceux dont il libère une attente. Ce qu'écrit
     * une passe supplantée n'a plus à être publié, sinon elle rallume une
     * attente que plus rien n'éteindra.
     *
     * Par behavior et non par champ : `recover()` passe sur **tous** les champs
     * montés dès que la convergence expire, et un compteur de champ rendait
     * muet, définitivement, un behavior voisin qui n'avait rien en vol.
     */
    private readonly generations = new Map<IBehavior<T, M>, number>();
    private readonly listeners = new Set<Listener>();

    private host: FieldHost | null = null;
    private required: boolean;
    private readonly requiredMessage?: string;
    private readonly requiredTrue?: boolean;
    /** Conservée pour que `reset()` restaure au lieu de vider. */
    private readonly initialValue: T | undefined;
    private value: T | undefined;
    private viewLocked = false;
    private viewReadOnly = false;
    private options: readonly FieldOption<OptionValue<T>, M>[];
    private touched = false;
    private focused = false;
    private submitting = false;
    private validity: ValidityFlag = "pristine";
    private current: FieldSnapshot<T, M>;
    private abort = new AbortController();
    private unsubscribeValidator: (() => void) | null = null;

    constructor(params: FieldParams<T, M>) {
        this.name = params.name;
        this.behaviors = params.behaviors ?? [];
        // Always a validator: validity then has exactly one source, with no
        // "is there one?" branch anywhere (invariants 13, 16).
        this.validator = toValidator(params.validator);
        this.required = params.required ?? false;
        this.requiredMessage = params.requiredMessage;
        this.requiredTrue = params.requiredTrue;
        this.initialValue = params.initialValue;
        this.value = params.initialValue;
        this.options = params.options ?? [];

        for (const behavior of this.behaviors) {
            this.statesByBehavior.set(behavior, BehaviorState.neutral);
        }

        this.current = this.buildSnapshot();
    }

    // ── wiring ───────────────────────────────────────────────────────────
    /** Called once by the FormController the field joins. */
    attach(host: FieldHost): void {
        // Un `IValidator` porte son état — verdict, options, jeton de run. Deux
        // champs qui en partagent un se voient mutuellement leurs erreurs. Un
        // behavior, lui, peut être partagé : il ne retient rien.
        // Qualifié par le formulaire porteur : deux lignes d'une même liste ont
        // les mêmes noms de champ, et comparer le nom seul laissait passer le
        // partage — le dernier verdict écrasait celui de l'autre ligne, jusqu'à
        // faire accepter une valeur explicitement refusée.
        const identity = `${host.formView().name}.${this.name}`;
        const owner = OWNERS.get(this.validator);
        if (owner !== undefined && owner !== identity) {
            throw new Error(
                `[slz] Validator already used by field "${owner}": an IValidator holds its own `
                + `state and cannot be shared with "${identity}". Create one per field, or `
                + "compose it — the members of a composite may be shared.",
            );
        }
        OWNERS.set(this.validator, identity);

        if (this.host && this.host !== host) {
            throw new Error(`[slz] Field "${this.name}" is already attached to another form.`);
        }
        this.host = host;
    }

    /** Names this field reacts to — the FormController builds its graph from this. */
    /**
     * Les champs que ce champ observe — behaviors **et** validator confondus.
     *
     * Le `watch` du validator entre dans le même graphe : c'est ce qui fait
     * qu'une validation croisée est rejouée quand sa dépendance change, sans
     * que le consommateur ait à la déclencher.
     */
    dependencies(): readonly string[] {
        for (const behavior of this.behaviors) {
            for (const target of behavior.watch ?? []) {
                if (watchedTriggers(target).length === 0) {
                    throw new Error(
                        `[slz] Behavior on "${this.name}" watches "${watchedName(target)}" `
                        + "with an empty `on`: it would never fire. Remove `on` for the default.",
                    );
                }
            }
        }
        return [...new Set([
            ...this.behaviors.flatMap((behavior) => (behavior.watch ?? []).map(watchedName)),
            ...(this.validator.watch ?? []),
        ])];
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    mount(): void {
        if (!this.lifecycle.mount()) {
            return;
        }
        // Un `change()` est permis avant le montage : le travail qu'il a pu
        // lancer ne doit pas survivre au signal qui le remplace.
        this.abort.abort();
        this.abort = new AbortController();
        // Deux canaux : republier ce que le validator dit déjà, et le **rejouer**
        // quand il se déclare périmé sans que la valeur ait bougé — des constats
        // injectés, par exemple.
        const stopListening = this.validator.subscribe(() => this.commit());
        const stopStale = this.validator.onStale(() => void this.revalidate());
        this.unsubscribeValidator = () => {
            stopListening();
            stopStale();
        };
        // Le formulaire peut déjà être en train de partir : un champ monté
        // entre-temps n'était pas dans la liste figée à l'entrée de `submit()`,
        // et niait un fait que le formulaire affirmait.
        this.submitting = this.host?.formView().status === "submitting";
        this.run("onMount");
        // Le verdict doit exister dès le montage : sans ça un champ obligatoire
        // et vide n'a aucun constat, et le formulaire se croit soumettable.
        // L'affichage, lui, reste gouverné par `touched` — rien n'apparaît.
        void this.revalidate();
    }

    update(params: FieldUpdate<T, M>): void {
        this.lifecycle.update(() => {
            if (params.required !== undefined && params.required !== this.required) {
                this.required = params.required;
                void this.revalidate();
            }
            if (params.options !== undefined) {
                this.options = params.options;
            }
            // `"value" in params` et non `!== undefined` : sans ça, le parent ne
            // peut jamais **effacer** une valeur qu'il pilote.
            if ("value" in params) {
                this.assign(params.value);
            }
            if (params.locked !== undefined) {
                this.viewLocked = params.locked;
            }
            if (params.readOnly !== undefined) {
                this.viewReadOnly = params.readOnly;
            }
            this.commit();
        });
    }

    unmount(): void {
        if (!this.lifecycle.unmount()) {
            return;
        }
        // Un champ démonté n'a plus le focus. Le garder publiait `focused` sur
        // un champ qui n'est plus là.
        this.focused = false;
        this.abort.abort();
        this.unsubscribeValidator?.();
        this.unsubscribeValidator = null;

        for (const behavior of this.behaviors) {
            // `invoke` et non un appel nu : c'était le seul hook hors du chemin
            // protégé. Une exception ici sortait de `form.unmount()`, laissait
            // les champs suivants montés, ce champ-ci en zombie — démonté mais
            // publiant encore `mounted` — et les abonnements du validator en
            // fuite.
            const ctx = this.buildContext(behavior, this.abort.signal);
            // `invoke` couvre le throw synchrone ; le `catch` couvre le hook
            // écrit `async`, dont le rejet serait sinon une promesse non
            // rattrapée — c'est-à-dire la fin du process sous Node.
            const result = this.invoke(() => behavior.onUnmount?.(ctx));
            this.invoke(() => {
                if (isPromise(result)) {
                    // `Promise.resolve` et non `result.catch` : `isPromise` ne
                    // vérifie que `then`. Un thenable sans `catch` faisait lever
                    // `unmount()` lui-même, donc sautait la neutralisation des
                    // tranches, l'abandon du validator et le `commit` final —
                    // exactement la panne que le passage par `invoke` corrigeait.
                    void Promise.resolve(result).catch(
                        (error: unknown) => reportEngineError(this.name, error),
                    );
                }
                return undefined;
            });
        }
        // Un démontage en vol laissait la tranche sur `loading` + `locked` :
        // le signal est avorté, donc plus rien ne viendrait la libérer.
        for (const behavior of this.behaviors) {
            this.statesByBehavior.set(behavior, BehaviorState.neutral);
        }
        this.openPasses.clear();
        // Le validator contribue lui aussi à l'activité, et rien ne l'aurait
        // arrêté : un champ démonté pendant qu'une règle asynchrone tournait
        // gardait `loading` pour toujours.
        this.validator.abandon();
        // Un membre de composite peut être partagé entre plusieurs champs :
        // garder l'abonnement d'un champ détruit ferait grossir sa liste
        // d'auditeurs sans fin. Le prochain tour de validation le rétablit.
        // Composite ou décorateur : les deux tiennent un abonnement à ce
        // qu'ils enveloppent, et l'enveloppé peut être partagé.
        if (this.validator instanceof CompositeValidator
            || this.validator instanceof DebouncedValidator) {
            this.validator.detach();
        }
        this.commit();
    }

    get isMounted(): boolean {
        return this.lifecycle.isMounted;
    }

    get isUnmounted(): boolean {
        return this.lifecycle.isUnmounted;
    }

    /**
     * Un travail asynchrone est en cours : un behavior en vol, ou le validator.
     *
     * C'est le signal sur lequel le FormController s'appuie pour ne pas
     * soumettre un formulaire dont toutes les valeurs ne sont pas encore posées.
     */
    get isBusy(): boolean {
        return this.current.ui.activity === "loading";
    }

    /**
     * Revalide tout de suite, sans attendre un éventuel délai.
     *
     * Appelé par le FormController après qu'un behavior a écrit une valeur
     * pendant la soumission : la nouvelle valeur doit être jugée, pas l'ancienne.
     */
    async validateNow(): Promise<void> {
        // Même ordre qu'au blur : on lance la revalidation *puis* on fait partir
        // le différé. L'inverse trancherait sur la valeur précédente.
        const pending = this.revalidate();
        this.validator.flush();
        await pending;
    }

    /**
     * Libère un champ resté en vol.
     *
     * Une requête qui ne répond jamais laissait `loading` + `locked` en place,
     * donc `isBusy` vrai — et **toute** soumission ultérieure échouait. Le
     * FormController appelle ceci quand la convergence expire.
     */
    recover(): void {
        // Le validator contribue aussi à l'axe activité : le laisser en vol
        // suffisait à garder `isBusy` vrai, donc à condamner le formulaire.
        this.validator.abandon();
        for (const [behavior, state] of this.statesByBehavior) {
            if (state.activity === "loading") {
                // Même règle qu'après un rejet : on rend l'attente, et elle
                // seule. Un `skeleton` posé pendant l'appel disparaît — sans
                // quoi la vue resterait en squelette pour toujours, le signal
                // étant avorté — mais un fait posé au montage survit, puisque
                // `onMount` n'est pas rejoué.
                //
                // Et seul **ce** behavior est supplanté : `recover()` passe sur
                // tous les champs montés dès que la convergence expire, et
                // supplanter le champ entier rendait muet, définitivement, un
                // voisin qui n'avait rien en vol.
                this.supersede(behavior);
                const passes = this.openPasses.get(behavior) ?? [];
                // La plus ancienne : c'est l'état d'avant que quoi que ce soit
                // ne commence. Tout est abandonné d'un coup, donc tout se ferme.
                const oldest = passes[0]
                    ?? { before: state, generation: 0, detached: true, owned: true };
                this.openPasses.delete(behavior);
                this.release(behavior, oldest);
            }
        }
        this.commit();
    }

    // ── events ───────────────────────────────────────────────────────────
    /** A user interaction: marks the field touched, unlike a programmatic write. */
    change(next: T | undefined): void {
        // La garde vise le **démontage**, pas l'absence de montage : un champ
        // qui n'est pas encore monté est en cours de mise en place, alors qu'un
        // champ démonté ne fait plus partie du formulaire.
        if (this.lifecycle.isUnmounted) {
            return;
        }
        this.touched = true;
        this.assign(next);
    }

    focus(): void {
        if (this.focused || this.lifecycle.isUnmounted) {
            return;
        }
        this.focused = true;
        this.run("onFocus");
    }

    blur(): void {
        if (this.lifecycle.isUnmounted) {
            return;
        }
        this.focused = false;
        this.touched = true;
        this.run("onBlur");
        // `flush` après avoir lancé la revalidation : une validation différée
        // part sans attendre son délai. Quitter un champ doit trancher tout de
        // suite, pas 400 ms plus tard.
        const pending = this.revalidate();
        this.validator.flush();
        void pending;
    }

    async submit(): Promise<void> {
        this.touched = true;
        this.run("onSubmit");
        const pending = this.revalidate();
        this.validator.flush();
        await pending;
    }

    setSubmitting(submitting: boolean): void {
        if (this.submitting === submitting) {
            return;
        }
        this.submitting = submitting;
        this.commit();
    }

    /** Sans argument, restaure la valeur initiale déclarée à la création. */
    reset(initialValue?: T): void {
        this.value = arguments.length > 0 ? initialValue : this.initialValue;
        this.touched = false;
        this.focused = false;
        this.validity = "pristine";
        this.validator.reset();
        for (const behavior of this.behaviors) {
            this.statesByBehavior.set(behavior, BehaviorState.neutral);
        }
        this.openPasses.clear();
        for (const behavior of this.behaviors) {
            this.supersede(behavior);
        }
        // Effacer les tranches ne suffit pas : la condition qui les avait
        // produites tient toujours. Sans rejouer le montage, un champ
        // conditionnel masqué réapparaissait et bloquait la soumission.
        if (this.lifecycle.isMounted) {
            this.run("onMount");
        } else {
            this.commit();
        }
        // Le verdict doit repartir de la valeur restaurée. Sans ça, un champ
        // obligatoire redevenu vide se déclarait soumettable — le montage
        // revalide justement pour éviter ça, la remise à zéro le doit aussi.
        void this.revalidate();
    }

    // ── read surface ─────────────────────────────────────────────────────
    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    getSnapshot = (): FieldSnapshot<T, M> => this.current;

    get snapshot(): FieldSnapshot<T, M> {
        return this.current;
    }

    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    listen = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /** ET — le champ porte **tous** ces flags. */
    hasFlag(...flags: AnyUiFlag[]): boolean {
        return this.current.ui.hasFlag(...flags);
    }

    /** OU — le champ porte **au moins un** de ces flags. */
    hasAny(...flags: AnyUiFlag[]): boolean {
        return this.current.ui.hasAny(...flags);
    }

    view(): FieldView<T, M> {
        const snapshot = this.current;
        return {
            name: this.name,
            value: snapshot.value,
            ui: snapshot.ui,
            errors: snapshot.errors,
            issues: snapshot.issues,
            options: snapshot.options,
            hasFlag: (...flags) => snapshot.hasFlag(...flags),
            hasAny: (...flags) => snapshot.hasAny(...flags),
        };
    }

    // ── dependency reaction (driven by the FormController) ───────────────
    notifyDependency(dependency: AnyFieldView, changes: FieldChanges): void {
        if (!this.lifecycle.isMounted) {
            return;
        }
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            // `filter` et non `find` : un behavior peut déclarer le même champ
            // plusieurs fois, avec des axes différents. Ne lire que la première
            // déclaration rendrait les suivantes muettes.
            const targets = (behavior.watch ?? [])
                .filter((watched) => watchedName(watched) === dependency.name);
            if (targets.length === 0) {
                continue;
            }
            // Un behavior n'est réveillé que par les axes qu'il a demandés.
            // `["value"]` par défaut, ce qui laisse l'arbitrage 18 intact.
            const woken = targets.some((target) =>
                watchedTriggers(target).some((trigger) => changes[trigger]));
            if (!woken) {
                continue;
            }
            const ctx = this.buildContext(behavior, signal);
            this.dispatch(behavior, signal, () => behavior.onDependencyChanged?.(ctx, dependency));
        }

        // Le validator observe lui aussi : une règle croisée doit être rejouée
        // quand la valeur dont elle dépend change.
        if (changes.value && this.validator.watch?.includes(dependency.name)) {
            void this.revalidate();
            return;
        }
        this.commit();
    }

    // ── internals ────────────────────────────────────────────────────────
    /** Programmatic write: same propagation as `change`, without marking touched. */
    private assign(next: T | undefined): void {
        if (Object.is(this.value, next)) {
            return;
        }
        this.value = next;
        this.runChange(next);
        void this.revalidate();
    }

    /**
     * Ne rejette **jamais**.
     *
     * Presque tous ses appelants l'ignorent par `void` — un rejet deviendrait
     * une promesse non rattrapée, c'est-à-dire la fin du process sous Node. Une
     * règle qui casse n'est pas un verdict : `handle` garde le dernier en date,
     * et ce qui remonte jusqu'ici est signalé sans être propagé.
     */
    private async revalidate(): Promise<void> {
        try {
            await this.runValidation();
        } catch (error) {
            reportEngineError(this.name, error);
            this.commit();
        }
    }

    private async runValidation(): Promise<void> {
        // Re-sent on every run: `required` can change after construction, and
        // the message must not be dropped along the way.
        this.validator.setOptions({
            required: this.required,
            requiredMessage: this.requiredMessage,
            requiredTrue: this.requiredTrue,
        });
        await this.validator.handle(this.value, this.buildValidationContext());
        this.commit();
    }

    /**
     * Ce que le validator reçoit pour statuer : une lecture du formulaire, et
     * rien d'autre. Aucune méthode de mutation (invariant 8), et `watched()`
     * refuse un nom non déclaré (invariants 7, 23).
     */
    private buildValidationContext(): ValidationContext {
        const watch = this.validator.watch ?? [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- object-literal getters need the instance captured
        const field = this;

        return {
            name: this.name,
            get form(): FormView {
                return field.host?.formView() ?? detachedForm(field.name);
            },
            get signal(): AbortSignal {
                return field.abort.signal;
            },
            watched: (name) => {
                if (!watch.includes(name)) {
                    throw new Error(
                        `[slz] Validator on "${this.name}" reads "${name}" without declaring it in \`watch\`.`,
                    );
                }
                return this.host?.formView().field(name) ?? null;
            },
        };
    }

    private run(hook: BehaviorHook): void {
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            const ctx = this.buildContext(behavior, signal);
            this.dispatch(behavior, signal, () => behavior[hook]?.(ctx));
        }
        this.commit();
    }

    /**
     * Exécute un hook de behavior en absorbant ce qu'il lève.
     *
     * Un behavior fautif ne doit emporter ni les autres behaviors du champ, ni
     * la revalidation qui suit, ni la file de propagation du formulaire : un
     * bug local resterait local.
     */
    private invoke(hook: () => BehaviorResult): BehaviorResult {
        try {
            return hook();
        } catch (error) {
            reportEngineError(this.name, error);
            return undefined;
        }
    }

    private runChange(value: T | undefined): void {
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            const ctx = this.buildContext(behavior, signal);
            this.dispatch(behavior, signal, () => behavior.onChange?.(ctx, value));
        }
        this.commit();
    }

    /**
     * Appelle un hook, la passe ouverte **avant** de l'appeler.
     *
     * Avant, parce que le préfixe synchrone d'un hook `async` s'exécute dans
     * `invoke`. Ouvrir après le laissait poser la référence lui-même, avec ses
     * propres écritures déjà appliquées — la passe rendait alors le masquage
     * qu'elle venait de poser.
     */
    private dispatch(
        behavior: IBehavior<T, M>,
        signal: AbortSignal,
        call: () => BehaviorResult,
    ): void {
        const pass: Pass = {
            before: this.statesByBehavior.get(behavior) ?? BehaviorState.neutral,
            generation: this.generationOf(behavior),
            detached: false,
            owned: false,
        };
        this.passesOf(behavior).push(pass);

        const result = this.invoke(call);
        this.apply(behavior, result, signal, pass);

        // La passe ne reste ouverte que si **elle** a ouvert l'attente. Regarder
        // l'activité du behavior au lieu de sa contribution laissait ouverte
        // toute passe traversant un `loading` posé par une autre — or `run` en
        // dispatche une par behavior, même quand il n'implémente pas le hook.
        // Chaque `focus`, `blur` ou `submit` pendant un appel en laissait donc
        // une derrière lui, et `recover()`, qui prend la plus ancienne, rendait
        // contre l'une d'elles.
        const opened = pass.before.activity !== "loading"
            && this.statesByBehavior.get(behavior)?.activity === "loading";
        if (isPromise(result)) {
            return;
        }
        if (opened) {
            // Elle a ouvert une attente sans rien qui retombera : c'est la
            // définition d'une détachée, et c'est le retour à `idle` qui la
            // refermera. La laisser telle quelle en faisait un fantôme
            // définitif, que `recover()` prenait ensuite pour référence.
            pass.detached = true;
            return;
        }
        this.close(behavior, pass);
    }

    private passesOf(behavior: IBehavior<T, M>): Pass[] {
        const existing = this.openPasses.get(behavior);
        if (existing) {
            return existing;
        }
        const created: Pass[] = [];
        this.openPasses.set(behavior, created);
        return created;
    }

    /**
     * Une passe vient de retomber en laissant `loading` allumé et plus personne
     * pour l'éteindre : on la réadopte, avec **son** état d'entrée.
     *
     * C'est ce qui ferme la classe : plus aucune attente ne se retrouve sans
     * titulaire, donc le repli de `recover()` — qui rendait contre l'état
     * courant, c'est-à-dire ne rendait rien — devient inatteignable.
     */
    private adopt(behavior: IBehavior<T, M>, pass: Pass): void {
        if (this.statesByBehavior.get(behavior)?.activity !== "loading") {
            return;
        }
        if ((this.openPasses.get(behavior)?.length ?? 0) > 0) {
            return;
        }
        this.passesOf(behavior).push({
            before: pass.before,
            generation: this.generationOf(behavior),
            detached: true,
            owned: true,
        });
    }

    /** Ferme une passe. Idempotent : une passe déjà fermée est simplement absente. */
    private close(behavior: IBehavior<T, M>, pass: Pass): void {
        const passes = this.openPasses.get(behavior);
        if (!passes) {
            return;
        }
        const at = passes.indexOf(pass);
        if (at >= 0) {
            passes.splice(at, 1);
        }
        if (passes.length === 0) {
            this.openPasses.delete(behavior);
        }
    }

    private apply(
        behavior: IBehavior<T, M>,
        result: BehaviorResult,
        signal: AbortSignal,
        pass: Pass,
    ): void {
        if (result instanceof BehaviorState) {
            this.setSlice(behavior, result);
            return;
        }
        if (!isPromise(result)) {
            // Returning nothing means "no opinion": the previous slice is kept.
            return;
        }
        // La souscription elle-même passe par `invoke` : appeler `then` peut
        // lever, et l'exception sortait alors de `mount()` ou de `change()`,
        // laissant les champs suivants non montés.
        this.invoke(() => {
            void result.then(
                (state) => {
                    this.close(behavior, pass);
                    if (signal.aborted || pass.generation !== this.generationOf(behavior)) {
                        this.adopt(behavior, pass);
                        return;
                    }
                    if (!(state instanceof BehaviorState)) {
                        // « Pas d'avis » : la tranche précédente est conservée,
                        // attente comprise — il faut donc quelqu'un pour la tenir.
                        this.adopt(behavior, pass);
                        return;
                    }
                    this.setSlice(behavior, state);
                    this.adopt(behavior, pass);
                    this.commit();
                },
                // En **second argument**, pas en `.catch` chaîné : sans quoi un
                // gestionnaire de succès qui lève — `commit()` notifie des
                // abonnés sans filet — envoyait une passe réussie dans le
                // chemin d'échec, et la fermait deux fois.
                (error: unknown) => {
                    this.close(behavior, pass);
                    if (signal.aborted || pass.generation !== this.generationOf(behavior)) {
                        this.adopt(behavior, pass);
                        return;
                    }
                    // Un behavior rejeté ne doit rien laisser derrière lui de ce
                    // que **sa** passe avait posé : ni `loading`, ni le verrou, ni
                    // le masquage, ni un `skeleton`. Un champ resté `invisible`
                    // sort du payload — donc une valeur obligatoire disparaît en
                    // silence et le formulaire se déclare valide.
                    this.release(behavior, pass);
                    this.adopt(behavior, pass);
                    // Et il est signalé : le chemin synchrone passe par `invoke`,
                    // qui rapporte. Se taire ici rendait un behavior asynchrone
                    // définitivement muet, sans une ligne de journal.
                    reportEngineError(this.name, error);
                    this.commit();
                },
            );
            return undefined;
        });
    }

    /**
     * Range la tranche, et tient les passes **détachées**.
     *
     * `ctx.push` s'utilise après coup : un behavior abonné à une source externe
     * allume `loading` hors de tout hook. Cette attente-là n'appartient à
     * aucune passe, et sans référence `recover()` n'avait plus rien à quoi la
     * comparer — il ne rendait donc rien.
     */
    private setSlice(behavior: IBehavior<T, M>, next: BehaviorState): void {
        const previous = this.statesByBehavior.get(behavior) ?? BehaviorState.neutral;
        this.statesByBehavior.set(behavior, next);

        if (next.activity === "loading") {
            const passes = this.openPasses.get(behavior);
            // La dernière ouverte est celle qui écrit — c'est elle qui tient
            // l'attente. À chaque écriture, et pas seulement à l'allumage : une
            // seconde passe qui rejoint une attente déjà en cours en est
            // titulaire elle aussi, sans quoi le rejet de la première déclarait
            // le champ au repos pendant que la seconde travaillait.
            const owner = passes?.[passes.length - 1];
            if (owner) {
                owner.owned = true;
            } else {
                // Aucune passe ouverte : l'écriture vient d'un abonnement
                // externe, et elle ouvre sa propre passe détachée.
                this.passesOf(behavior).push({
                    before: previous,
                    generation: this.generationOf(behavior),
                    detached: true,
                    owned: true,
                });
            }
            return;
        }
        // Retour au repos : plus personne ne tient d'attente, et ce qu'aucune
        // promesse ne refermera est refermé ici.
        for (const pass of [...(this.openPasses.get(behavior) ?? [])]) {
            pass.owned = false;
            if (pass.detached) {
                this.close(behavior, pass);
            }
        }
    }

    private generationOf(behavior: IBehavior<T, M>): number {
        return this.generations.get(behavior) ?? 0;
    }

    /** Ouvre une passe neuve : ce que la précédente écrirait encore est ignoré. */
    private supersede(behavior: IBehavior<T, M>): void {
        this.generations.set(behavior, this.generationOf(behavior) + 1);
    }

    /**
     * Rend une passe — **ce qu'elle a ajouté, et rien d'autre**.
     *
     * Ni la tranche entière (un fait posé au montage disparaîtrait, et
     * `onMount` n'est pas rejoué), ni son état d'entrée tel quel (un flag que
     * le behavior venait de **retirer** reviendrait : un champ masqué qui se
     * montre puis échoue redevenait invisible, donc sortait du payload — et le
     * formulaire se déclarait valide sans sa valeur obligatoire).
     *
     * La règle exacte est l'**intersection** : on garde ce qui était là à
     * l'entrée de la passe et qui y est encore. Ce qu'elle a ajouté part, ce
     * qu'elle a retiré reste retiré.
     */
    private release(behavior: IBehavior<T, M>, pass: Pass): void {
        const current = this.statesByBehavior.get(behavior) ?? BehaviorState.neutral;
        const kept = current.markers.filter((flag) => pass.before.has(flag));
        // `idle` seulement si plus rien n'est en vol : une passe sœur encore en
        // cours rendait sinon le formulaire soumettable pendant que le behavior
        // travaillait toujours.
        // Une sœur **qui travaille**, pas une sœur ouverte : une passe ouverte
        // n'est pas une passe en vol, et le `loading` publié ici n'aurait alors
        // eu personne pour l'éteindre.
        const stillWaiting = (this.openPasses.get(behavior) ?? []).some((open) => open.owned);
        this.setSlice(behavior, new BehaviorState(stillWaiting ? "loading" : "idle", kept));
    }

    private buildContext(behavior: IBehavior<T, M>, signal: AbortSignal): BehaviorContext<T, M> {
        const watch = (behavior.watch ?? []).map(watchedName);
        // La génération de la passe qui reçoit ce contexte : ce qu'écrit une
        // passe supplantée n'a plus à être publié. Sans cette capture, la garde
        // ne couvrait que la **sortie** de la passe — `ctx.push` pouvait donc
        // encore allumer `loading`, et plus rien ne venait l'éteindre, puisque
        // `release` était justement écarté par le jeton.
        const generation = this.generationOf(behavior);
        const superseded = (): boolean => signal.aborted || generation !== this.generationOf(behavior);
        // Captured explicitly: `state`, `ui` and `form` are getters, so they must
        // read the controller live — a behavior that resumes after an `await`
        // needs the current values, not those captured when the hook was called.
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- object-literal getters need the instance captured
        const field = this;

        return {
            name: this.name,
            get state(): BehaviorState {
                return field.statesByBehavior.get(behavior) ?? BehaviorState.neutral;
            },
            get ui(): UiState {
                return field.current.ui;
            },
            get form(): FormView {
                return field.host?.formView() ?? detachedForm(field.name);
            },
            signal,
            getValue: () => this.value,
            setValue: (next) => {
                if (superseded()) {
                    return;
                }
                this.assign(next);
            },
            setOptions: (options) => {
                if (superseded()) {
                    return;
                }
                this.options = options;
                this.commit();
            },
            watched: (name) => {
                if (!watch.includes(name)) {
                    throw new Error(
                        `[slz] Behavior on "${this.name}" reads "${name}" without declaring it in \`watch\`.`,
                    );
                }
                return this.host?.formView().field(name) ?? null;
            },
            push: (state) => {
                if (superseded()) {
                    return;
                }
                this.setSlice(behavior, state);
                this.commit();
            },
        };
    }

    private commit(): void {
        const next = this.buildSnapshot();
        if (this.current.equals(next)) {
            return;
        }
        const changes: FieldChanges = {
            value: !Object.is(this.current.value, next.value),
            // Le verdict **et** son affichage : `validity` reste `pristine`
            // tant qu'on n'a pas touché le champ, donc s'y fier seul laissait
            // un observateur attendre indéfiniment qu'un champ prérempli
            // devienne valide.
            validity: this.current.ui.validity !== next.ui.validity
                || blocking(this.current) !== blocking(next),
            activity: this.current.ui.activity !== next.ui.activity,
        };
        this.current = next;
        for (const listener of this.listeners) {
            listener();
        }
        this.host?.notifyFieldChanged(this.name, changes);
    }

    private buildSnapshot(): FieldSnapshot<T, M> {
        const state = this.validator.getState();
        this.validity = this.resolveValidity(state.status);

        return new FieldSnapshot<T, M>({
            name: this.name,
            value: this.value,
            // A submitting form locks its fields: that is a controller-level fact,
            // not something every consumer should have to re-derive from
            // `isSubmitting` next to `isLocked`.
            ui: UiState.merge(
                this.validity,
                this.statesByBehavior.values(),
                state.status === "loading",
                this.ownMarkers(),
            ),
            issues: state.issues,
            options: this.options,
        });
    }

    /**
     * Les flags que le contrôleur et la vue ajoutent à ceux des behaviors.
     *
     * Tout ce qui était un booléen à part — l'interaction, l'obligation, la
     * présence — est ici : c'est ce qui permet à la surface de lecture de n'être
     * que des flags (invariant 32).
     */
    private ownMarkers(): readonly AnyUiFlag[] {
        const flags: AnyUiFlag[] = [];
        // Un formulaire en cours de soumission verrouille ses champs : c'est un
        // fait de contrôleur, pas quelque chose que chaque consommateur devrait
        // re-dériver à côté de `locked`.
        if (this.submitting) {
            // Un formulaire qui part verrouille ses champs — mais la vue doit
            // pouvoir distinguer ce verrou-là de celui d'un behavior.
            flags.push("submitting", "locked");
        }
        if (this.viewLocked) {
            flags.push("locked");
        }
        if (this.viewReadOnly) {
            flags.push("readonly");
        }
        if (this.required) {
            flags.push("required");
        }
        if (this.touched) {
            flags.push("touched");
        }
        if (this.focused) {
            flags.push("focused");
        }
        if (this.lifecycle.isMounted) {
            flags.push("mounted");
        }
        return flags;
    }

    private resolveValidity(status: ValidatorStatus): ValidityFlag {
        if (!this.touched) {
            return "pristine";
        }
        switch (status) {
            case "error":
                return "error";
            case "valid":
                return "valid";
            case "loading":
                // Keep the last verdict while revalidating instead of flashing pristine.
                return this.validity;
            case "pristine":
                return "pristine";
        }
    }
}

/**
 * Le **verdict** : ce champ bloque-t-il, indépendamment de l'affichage ?
 *
 * `errors` ne retient que les constats de gravité `error`, donc en avoir un
 * suffit. Le flag `error`, lui, reste éteint tant que le champ n'a pas été
 * touché — un prefill ne doit pas allumer de message (arbitrage 24).
 */
function blocking(snapshot: { readonly errors: readonly string[] }): boolean {
    return snapshot.errors.length > 0;
}

/**
 * Ne lève jamais : lire `.then` peut déclencher un accesseur piégé, et le test
 * est fait hors de `invoke` — un `mount()` ou un `change()` en serait sorti,
 * laissant les champs suivants non montés.
 */
function isPromise(value: unknown): value is Promise<BehaviorState | void> {
    try {
        return typeof (value as Promise<unknown> | undefined)?.then === "function";
    } catch {
        return false;
    }
}

/** A field used outside any form still gets a valid, empty read surface. */
function detachedForm(name: string): FormView {
    return {
        name: `<detached:${name}>`,
        status: "idle",
        field: () => null,
        values: () => ({}),
    };
}

/** Un tableau devient un composite ; l'absence de validator, le validator par défaut. */
function toValidator<T>(validator?: IValidator<T> | readonly IValidator<T>[]): IValidator<T> {
    if (validator === undefined) {
        return new DefaultValidator<T>();
    }
    if (Array.isArray(validator)) {
        const members = validator as readonly IValidator<T>[];
        return members.length === 1 && members[0] !== undefined
            ? members[0]
            : new CompositeValidator<T>(members);
    }
    return validator as IValidator<T>;
}

/**
 * Une erreur du moteur — une garde violée, une règle qui casse — ne doit pas
 * remonter dans une promesse que personne n'attend. On la signale, bruyamment,
 * sans faire tomber l'application.
 */
function reportEngineError(field: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[slz] Validation of "${field}" failed: ${message}`, error);
}
