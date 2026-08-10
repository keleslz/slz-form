export interface TabDefinition {
    id: string;
    label: string;
    caption?: string;
    disabled?: boolean;
}

export interface TabsProps {
    tabs: readonly TabDefinition[];
    active: string;
    onSelect: (id: string) => void;
}

export function Tabs({ tabs, active, onSelect }: TabsProps) {
    return (
        <nav className="tabs" role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === active}
                    className={`tab${tab.id === active ? " is-active" : ""}`}
                    disabled={tab.disabled}
                    onClick={() => onSelect(tab.id)}
                >
                    <span className="tab__label">{tab.label}</span>
                    {tab.caption && <span className="tab__caption">{tab.caption}</span>}
                </button>
            ))}
        </nav>
    );
}
