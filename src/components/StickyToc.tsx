import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { annotate } from 'rough-notation';
import { SHELF_CONTENT_SWAP_DURATION_MS } from '../motion';

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


function StickyTocButton({ label, selected, visible, onClick }: { label: string; selected: boolean; visible: boolean; onClick: () => void }) {
  const highlightTargetRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const highlightTarget = highlightTargetRef.current;
    if (!visible || !selected || !highlightTarget) return;

    const annotation = annotate(highlightTarget, {
      type: 'highlight',
      color: getComputedStyle(highlightTarget).getPropertyValue('--editorial-ink').trim(),
      animationDuration: SHELF_CONTENT_SWAP_DURATION_MS,
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      iterations: 1,
    });
    annotation.show();
    return () => annotation.remove();
  }, [selected, visible]);

  return <button
    type="button"
    className={selected ? 'active' : ''}
    aria-label={label}
    aria-pressed={selected}
    onClick={onClick}
  >
    <span ref={highlightTargetRef} className="sticky-toc-highlight-target" aria-hidden="true" />
    <span className="sticky-toc-button-label">{label}</span>
  </button>;
}

export function StickyToc<T extends string>({ active, title, options, value, onChange, children }: StickyTocProps<T>) {
  return <div className={active ? 'sticky-toc-layout' : 'sticky-toc-layout-inactive'}>
    <aside className="sticky-toc" aria-label={`${title} 독자 연령 필터`} hidden={!active}>
      <nav aria-label="독자 연령">
        {options.map((option) => <StickyTocButton
          key={option.value}
          label={option.label}
          selected={option.value === value}
          visible={active}
          onClick={() => onChange(option.value)}
        />)}
      </nav>
    </aside>
    <div className={active ? 'sticky-toc-content' : 'sticky-toc-content-inactive'}>{children}</div>
  </div>;
}
