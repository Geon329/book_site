export type AudienceFilterOption<T extends string> = {
  value: T;
  label: string;
};

type AudienceFilterProps<T extends string> = {
  label: string;
  options: readonly AudienceFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function AudienceFilter<T extends string>({ label, options, value, onChange }: AudienceFilterProps<T>) {
  return <div className="audience-filter" role="group" aria-label={label}>
    {options.map((option) => {
      const selected = option.value === value;
      return <button
        key={option.value}
        type="button"
        className={selected ? 'active' : ''}
        aria-pressed={selected}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>;
    })}
  </div>;
}
