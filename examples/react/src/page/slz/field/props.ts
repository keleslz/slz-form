import type { FieldOption, IBehavior, IValidator, MetaOf, OptionValueOf, ValueOf } from "slz-form";
import type { CarFields } from "../../../form/car-configuration-form";

/** Les champs du formulaire dont la valeur est du type demandé. */
export type FieldsOfType<V> = {
    [K in keyof CarFields]: ValueOf<CarFields[K]> extends V ? K : never;
}[keyof CarFields];

/**
 * Idem, mais restreint aux champs dont les options ne portent pas de meta.
 *
 * Un composant qui accepte une liste d'options statique ne peut pas servir un
 * champ dont les options transportent des données métier : la liste passée par
 * la vue n'aurait pas ce meta.
 */
export type PlainFieldsOfType<V> = {
    [K in keyof CarFields]: ValueOf<CarFields[K]> extends V
        ? ([MetaOf<CarFields[K]>] extends [never] ? K : never)
        : never;
}[keyof CarFields];

type Value<K extends keyof CarFields> = ValueOf<CarFields[K]>;
type Meta<K extends keyof CarFields> = MetaOf<CarFields[K]>;

/**
 * Tout ce dont un champ a besoin : son nom, et éventuellement ce qu'on lui
 * branche. Plus de `form=` : les hooks sont déjà liés au formulaire.
 */
export interface SlzFieldProps<K extends keyof CarFields> {
    name: K;
    label: string;
    hint?: string;
    required?: boolean;
    requiredMessage?: string;
    initialValue?: Value<K>;
    validator?: IValidator<Value<K>>;
    behaviors?: readonly IBehavior<Value<K>, Meta<K>>[];
    options?: readonly FieldOption<OptionValueOf<CarFields[K]>, Meta<K>>[];
}

export const REQUIRED_MESSAGE = "Champ obligatoire";

/** Clé du compteur de rendus, cloisonnée à cet onglet. */
export const shellId = (name: string) => `slz:${name}`;
