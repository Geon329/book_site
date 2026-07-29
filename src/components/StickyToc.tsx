import type { ReactNode } from 'react';

export type StickyTocOption<T extends string> = {
  value: T;
  label: string;
};

type StickyTocProps<T extends string> = {
  active: boolean;
  title: string;
  options: readonly StickyTocOption<T>[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
};

export function StickyToc<T extends string>({ active, title, options, value, onChange, children }: StickyTocProps<T>) {
  return <div className={active ? 'sticky-toc-layout' : 'sticky-toc-layout-inactive'}>
    <aside className="sticky-toc" aria-label={`${title} 독자 연령 필터`} hidden={!active}>
      <nav aria-label="독자 연령">
        {options.map((option) => {
          const selected = option.value === value;
          return <button
            key={option.value}
            type="button"
            className={selected ? 'active' : ''}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >{option.label}</button>;
        })}
      </nav>
    </aside>
    <div className={active ? 'sticky-toc-content' : 'sticky-toc-content-inactive'}>{children}</div>
  </div>;
}
