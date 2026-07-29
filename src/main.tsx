import { FormEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import booksData from './books.json';
import { StickyToc, type StickyTocOption } from './components/StickyToc';
import choiceMakerLogo from '../logo_02.svg';
import editorialHero from '../item_01.png';
import stickyNotePosition1 from '../note_Combine_8.png';
import awardIcon from '../award-outline.png';
import moonFogIcon from '../moon-fog-outline.png';

type CoverFit = 'auto' | 'cover' | 'contain';
type CoverStatus = 'loading' | 'safe' | 'review' | 'exception' | 'unavailable';
type CoverAnalysis = { status: CoverStatus; cropFraction?: number };
type SchoolGrade = 'kindergarten' | 'elementary-1' | 'elementary-2' | 'elementary-3' | 'elementary-4' | 'elementary-5' | 'elementary-6' | 'middle-1' | 'middle-2' | 'middle-3' | 'high-1' | 'high-2' | 'high-3';
type AudienceBand = 'early-readers' | 'middle-grade' | 'young-adult';
type AudienceFilter = 'all' | AudienceBand;
type RecommendedAudience = {
  label: string;
  band?: AudienceBand;
  ageRange?: { min: number; max: number };
  schoolRange?: { from: SchoolGrade; to: SchoolGrade };
  evidenceLabel?: string;
  sourceType: 'yes24-category' | 'curated-recommendation' | 'unavailable';
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'unavailable';
  note?: string;
};
type Book = { id: string; title: string; english: string; author: string; illustrator: string; publisher?: string; categories: string[]; cover: string; coverFit?: CoverFit; intro?: string; introSource?: 'YES24_PARAPHRASE' | 'ADMIN'; awards?: string[]; rightsSold?: string[]; isbn?: string; specs?: string; keywords?: string; publishedAt?: string; listPrice?: number; yes24Url?: string; recommendedAudience?: RecommendedAudience; seriesId?: string; seriesTitle?: string; seriesNumber?: number };
type Store = { books: Book[]; categories: string[]; catalogVersion: number };
type CatalogState = { store: Store; selectedCategories: string[] };
type DetailAudience = 'public' | 'management';
type DetailIdentity = { kind: 'persisted'; bookId: string } | { kind: 'create' };
type DetailPhase = 'read' | 'edit' | 'resolve-dirty' | 'confirm-lifecycle' | 'confirm-close';
type LifecycleIntent = 'archive' | 'restore' | null;
type DetailState = { audience: DetailAudience; identity: DetailIdentity; phase: DetailPhase; baseline?: Book; draft?: Book; lifecycle: LifecycleIntent };
type ConfirmState = { message: string; action: () => void; trigger: HTMLElement | null };
type TopLayer = { kind: 'detail'; detail: DetailState } | { kind: 'confirm'; confirm: ConfirmState };
type Announcement = { sequence: number; text: string };

const storageKey = 'book-margin-demo-v2';
const catalogVersion = 5;
const schemaVersion = 1;
const adminDemoEnabled = import.meta.env.DEV;
const publicCategoryLabels: Readonly<Record<string, string>> = {
  픽션: 'Fictions',
  그림책: 'Picture Books',
  교육만화: 'Educational Comics',
  그래픽노블: 'Graphic Novels',
  언어학습: 'Language Learning',
  보관: 'Archived',
};
const publicCategoryLabel = (category: string) => publicCategoryLabels[category] ?? category;
const categoryIdForLabel = (label: string) => {
  const trimmed = label.trim();
  return Object.entries(publicCategoryLabels).find(([, value]) => value === trimmed)?.[0] ?? trimmed;
};
type CatalogDocument = { schemaVersion: number; catalogVersion: number; categories: string[]; books: Book[] };
type PersistedStore = Store & { sourceFingerprint?: string };
const fallbackCoverTokens = { surface: '#7b6d62', ink: '#ffffff' } as const;
const makeCover = (title: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="${fallbackCoverTokens.surface}"/><rect x="38" y="38" width="524" height="724" fill="none" stroke="${fallbackCoverTokens.ink}" stroke-opacity=".45"/><text x="72" y="610" fill="${fallbackCoverTokens.ink}" font-family="Georgia,serif" font-size="36">${title}</text><text x="72" y="678" fill="${fallbackCoverTokens.ink}" font-family="Arial,sans-serif" font-size="16" letter-spacing="4">BOOK MARGIN</text></svg>`)}`;
const minimumDetailTitleSize = 15;
const seriesNavigationCooldown = 220;
const shelfCategoryOrder = ['그림책', '픽션', '교육만화', '그래픽노블', '언어학습'];
const soldRightsPosition1BookIds = new Set(['star-cat-village-4']);
const audienceFilterOptions: readonly StickyTocOption<AudienceFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'early-readers', label: 'Early Readers' },
  { value: 'middle-grade', label: 'Middle Grade' },
  { value: 'young-adult', label: 'Young Adult' },
];
const publicCoverFrameRatio = 24 / 35;
const coverAnalyses = new Map<string, CoverAnalysis>();
const normalizeCoverFit = (value: unknown): CoverFit => value === 'cover' || value === 'contain' ? value : 'auto';
const classifyCover = (width: number, height: number): CoverAnalysis => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { status: 'unavailable' };
  const sourceRatio = width / height;
  const cropFraction = 1 - Math.min(sourceRatio / publicCoverFrameRatio, publicCoverFrameRatio / sourceRatio);
  return { status: cropFraction <= .08 ? 'safe' : cropFraction <= .18 ? 'review' : 'exception', cropFraction };
};
const resolvedCoverFit = (book: Book): 'cover' | 'contain' => {
  const preference = normalizeCoverFit(book.coverFit);
  return preference === 'auto' ? 'cover' : preference;
};
function useCoverAnalysis(cover: string): CoverAnalysis {
  const [analysis, setAnalysis] = useState<CoverAnalysis>(() => coverAnalyses.get(cover) ?? { status: 'loading' });
  useEffect(() => {
    const cached = coverAnalyses.get(cover);
    if (cached) {
      setAnalysis(cached);
      return;
    }
    setAnalysis({ status: 'loading' });
    const image = new Image();
    let active = true;
    const finish = (next: CoverAnalysis) => {
      if (!active) return;
      coverAnalyses.set(cover, next);
      setAnalysis(next);
    };
    image.onload = () => finish(classifyCover(image.naturalWidth, image.naturalHeight));
    image.onerror = () => finish({ status: 'unavailable' });
    image.src = cover;
    if (image.complete) finish(image.naturalWidth ? classifyCover(image.naturalWidth, image.naturalHeight) : { status: 'unavailable' });
    return () => { active = false; };
  }, [cover]);
  return analysis;
}
const normalizeCategories = (categories: unknown[]) => {
  const unique = [...new Set(categories.filter((item): item is string => typeof item === 'string' && item.trim() !== '' && item !== '보관'))];
  const position = (category: string) => {
    const index = shelfCategoryOrder.indexOf(category);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...unique].sort((left, right) => position(left) - position(right)).concat('보관');
};
const initial: Store = {
  catalogVersion,
  categories: normalizeCategories(booksData.categories),
  books: booksData.books.map((book) => normalizeBook(book as Book, normalizeCategories(booksData.categories))),
};
const sourceFingerprint = JSON.stringify(booksData);
const seedBooks = initial.books;
const seedBookById = new Map(seedBooks.map((book) => [book.id, book]));
function migrateSeedContent(book: Book, loadedVersion: number): Book {
  const seed = seedBookById.get(book.id);
  if (loadedVersion < catalogVersion && seed?.intro && book.introSource !== 'ADMIN') return { ...book, intro: seed.intro, introSource: seed.introSource };
  return book;
}
function normalizeStringList(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [...new Set(entries.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item !== '' && item !== '없음'))];
}
function normalizeBook(book: Book, categories: string[]): Book {
  const safeCategories = Array.isArray(book.categories) ? [...new Set(book.categories.filter((item) => categories.includes(item)))] : [];
  const hasStaticCover = typeof book.cover === 'string' && /^(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9._-]*\.(?:avif|webp|png|jpe?g)$/i.test(book.cover);
  const cover = typeof book.cover === 'string' && (book.cover.startsWith('data:image/svg+xml') || book.cover.startsWith('https://image.yes24.com/goods/') || hasStaticCover) ? book.cover : makeCover(book.title || '책');
  const normalized: Book = { ...book, categories: safeCategories, cover };
  normalized.awards = normalizeStringList((book as Book & { awards?: unknown }).awards);
  normalized.rightsSold = normalizeStringList((book as Book & { rightsSold?: unknown }).rightsSold);
  if (normalizeCoverFit(book.coverFit) === 'auto') delete normalized.coverFit;
  else normalized.coverFit = normalizeCoverFit(book.coverFit);
  if (typeof book.seriesId === 'string' && book.seriesId.trim()) normalized.seriesId = book.seriesId.trim();
  else delete normalized.seriesId;
  if (typeof book.seriesTitle === 'string' && book.seriesTitle.trim()) normalized.seriesTitle = book.seriesTitle.trim();
  else delete normalized.seriesTitle;
  if (typeof book.seriesNumber === 'number' && Number.isFinite(book.seriesNumber)) normalized.seriesNumber = book.seriesNumber;
  else delete normalized.seriesNumber;
  return normalized;
}
function parseCatalogDocument(value: unknown): Store {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('카탈로그 JSON 형식이 올바르지 않습니다.');
  const document = value as Record<string, unknown>;
  if (document.schemaVersion !== schemaVersion) throw new Error('지원하지 않는 카탈로그 스키마입니다.');
  if (document.catalogVersion !== catalogVersion) throw new Error('지원하지 않는 카탈로그 버전입니다.');
  if (!Array.isArray(document.categories) || !Array.isArray(document.books)) throw new Error('카테고리와 책 목록은 배열이어야 합니다.');
  const categories = normalizeCategories(document.categories);
  const seenIds = new Set<string>();
  const books = document.books.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('책 정보 형식이 올바르지 않습니다.');
    const book = item as Book;
    if (typeof book.id !== 'string' || book.id.trim() === '' || seenIds.has(book.id)) throw new Error('책 ID는 비어 있거나 중복될 수 없습니다.');
    if (typeof book.title !== 'string' || book.title.trim() === '') throw new Error('모든 책에는 제목이 필요합니다.');
    seenIds.add(book.id);
    return normalizeBook(book, categories);
  });
  return { catalogVersion, categories, books };
}
function appendCatalog(existing: Store, imported: Store): Store {
  const existingIds = new Set(existing.books.map((book) => book.id));
  const duplicate = imported.books.find((book) => existingIds.has(book.id));
  if (duplicate) throw new Error(`이미 등록된 책 ID입니다: ${duplicate.id}`);
  const categories = normalizeCategories([...existing.categories, ...imported.categories]);
  return {
    catalogVersion,
    categories,
    books: [
      ...existing.books.map((book) => normalizeBook(book, categories)),
      ...imported.books.map((book) => normalizeBook(book, categories)),
    ],
  };
}
function loadStore(): Store {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    if (!Array.isArray(parsed.books) || !Array.isArray(parsed.categories)) return initial;
    if (parsed.sourceFingerprint !== sourceFingerprint) return initial;
    const loadedVersion = typeof parsed.catalogVersion === 'number' ? parsed.catalogVersion : 0;
    const categories = normalizeCategories(parsed.categories);
    const books = parsed.books
      .filter((item): item is Book => Boolean(item && typeof item === 'object' && typeof item.id === 'string'))
      .map((item) => normalizeBook(migrateSeedContent(item, loadedVersion), categories));
    return { catalogVersion, categories, books };
  } catch {
    return initial;
  }
}
const copy = (book: Book): Book => ({ ...book, categories: [...book.categories], awards: [...(book.awards ?? [])], rightsSold: [...(book.rightsSold ?? [])] });
const focusable = (root: HTMLElement | null) => root ? [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => !node.closest('[inert]') && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length)) : [];

function ModalInteractionCoordinator(active: boolean, root: React.RefObject<HTMLElement | null>, initial: React.RefObject<HTMLElement | null>, onEscape: () => void, returnTo: () => HTMLElement | null) {
  const onEscapeRef = useRef(onEscape);
  const returnToRef = useRef(returnTo);
  onEscapeRef.current = onEscape;
  returnToRef.current = returnTo;

  useEffect(() => {
    if (!active) return;
    const shell = document.getElementById('app-shell');
    const hadInert = shell?.hasAttribute('inert');
    const overflow = document.body.style.overflow;
    shell?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => initial.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable(root.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!root.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keydown);
      if (!hadInert) shell?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => returnToRef.current()?.focus());
    };
  }, [active, initial, root]);
}
function StatusNotice({ announcement }: { announcement: Announcement }) { return <p className="status-notice" role="status" aria-live="polite" aria-atomic="true" data-sequence={announcement.sequence}>{announcement.text}</p>; }

function useAnnouncer() {
  const [announcement, setAnnouncement] = useState<Announcement>({ sequence: 0, text: '' });
  const frame = useRef<number | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return [announcement, (text: string) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const next = ++sequence.current;
    setAnnouncement({ sequence: next, text: '' });
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setAnnouncement({ sequence: next, text });
    });
  }] as const;
}
function App() {
  const [catalog, setCatalog] = useState<CatalogState>(() => ({ store: loadStore(), selectedCategories: [] }));
  const { store, selectedCategories: selected } = catalog;
  const [surface, setSurface] = useState<'public' | 'management'>('public');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [topLayer, setTopLayer] = useState<TopLayer | null>(null);
  const [notice, announce] = useAnnouncer();
  const publicHeading = useRef<HTMLHeadingElement>(null);
  const managementHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const priorSurface = useRef(surface);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify({ ...store, sourceFingerprint })); }, [store]);
  useEffect(() => {
    if (priorSurface.current === surface) return;
    priorSurface.current = surface;
    announce(surface === 'management' ? '서가 관리로 전환했습니다.' : '공개 서가로 전환했습니다.');
    requestAnimationFrame(() => (surface === 'management' ? managementHeading.current : publicHeading.current)?.focus());
  }, [surface]);
  const updateBook = (book: Book) => setCatalog((current) => ({ ...current, store: { ...current.store, books: current.store.books.some((item) => item.id === book.id) ? current.store.books.map((item) => item.id === book.id ? normalizeBook(book, current.store.categories) : item) : [...current.store.books, normalizeBook(book, current.store.categories)] } }));
  const updateBookCategories = (bookId: string, updateCategories: (categories: string[]) => string[]) => setCatalog((current) => {
    const currentBook = current.store.books.find((book) => book.id === bookId);
    if (!currentBook) return current;
    return {
      ...current,
      store: {
        ...current.store,
        books: current.store.books.map((book) => book.id === bookId ? normalizeBook({ ...book, categories: updateCategories(book.categories) }, current.store.categories) : book),
      },
    };
  });
  const openDetail = (audience: DetailAudience, identity: DetailIdentity, trigger: HTMLElement) => {
    opener.current = trigger;
    setTopLayer({ kind: 'detail', detail: { audience, identity, phase: 'read', lifecycle: null } });
  };
  const mutateCategory = (kind: 'rename' | 'delete', from: string, to = '') => {
    const next = categoryIdForLabel(to);
    if (kind === 'rename' && next === from) return true;
    const valid = from !== '보관' && store.categories.includes(from) && (kind === 'delete' || (next !== '' && next !== '보관' && !store.categories.includes(next)));
    if (!valid) {
      if (kind === 'rename') announce('카테고리 이름을 사용할 수 없습니다.');
      return false;
    }
    setCatalog((current) => ({
      store: {
        catalogVersion: current.store.catalogVersion,
        categories: kind === 'rename' ? current.store.categories.map((item) => item === from ? next : item) : current.store.categories.filter((item) => item !== from),
        books: current.store.books.map((book) => ({ ...book, categories: book.categories.map((item) => kind === 'rename' && item === from ? next : item).filter((item) => kind === 'rename' || item !== from) })),
      },
      selectedCategories: kind === 'rename' ? current.selectedCategories.map((item) => item === from ? next : item) : current.selectedCategories.filter((item) => item !== from),
    }));
    announce(kind === 'rename' ? '카테고리 이름을 변경했습니다.' : '카테고리를 삭제했습니다.');
    return true;
  };
  const togglePublicCategory = (category: string) => {
    setAudienceFilter('all');
    setCatalog((current) => ({ ...current, selectedCategories: current.selectedCategories.includes(category) ? [] : [category] }));
  };
  const activeBooks = store.books.filter((book) => !book.categories.includes('보관'));
  const selectedCategory = selected[0];
  const visible = activeBooks.filter((book) => !selected.length || book.categories.some((category) => selected.includes(category)));
  const audienceFiltered = selectedCategory === '픽션' && audienceFilter !== 'all'
    ? visible.filter((book) => book.recommendedAudience?.band === audienceFilter)
    : visible;
  const shelfBooks = Array.from(audienceFiltered.reduce((groups, book) => {
    const seriesId = book.seriesId?.trim();
    const key = seriesId && Number.isFinite(book.seriesNumber) ? `series:${seriesId}` : `book:${book.id}`;
    const current = groups.get(key);
    if (!current || (book.seriesNumber ?? Infinity) < (current.seriesNumber ?? Infinity)) groups.set(key, book);
    return groups;
  }, new Map<string, Book>()).values());
  const openConfirm = (confirm: ConfirmState) => setTopLayer({ kind: 'confirm', confirm });
  const importCatalog = (file: File) => {
    void file.text().then((text) => {
      const imported = parseCatalogDocument(JSON.parse(text));
      const merged = appendCatalog(store, imported);
      setCatalog({ store: merged, selectedCategories: [] });
      setTopLayer(null);
      announce(`${imported.books.length}권을 카탈로그에 추가했습니다. 이 브라우저에만 저장됩니다.`);
    }).catch((error: unknown) => announce(error instanceof Error ? `카탈로그 JSON을 가져오지 못했습니다: ${error.message}` : '카탈로그 JSON을 가져오지 못했습니다.'));
  };
  const exportCatalog = () => {
    const categories = normalizeCategories(store.categories);
    const payload: CatalogDocument = { schemaVersion, catalogVersion, categories, books: store.books.map((book) => normalizeBook(book, categories)) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'book-catalog.json';
    link.click();
    URL.revokeObjectURL(url);
    announce('카탈로그 JSON을 내보냈습니다.');
  };
  const featuredShelf = <section className="public-featured" id="featured-titles" aria-labelledby="featured-title-heading">
    <div className="public-featured-heading">
      <h2 id="featured-title-heading">{selectedCategory ? publicCategoryLabel(selectedCategory) : 'Featured Titles'}</h2>
      {!selectedCategory && <>
        <span className="public-featured-divider" aria-hidden="true" />
        <a href="#featured-titles">View all titles <span aria-hidden="true">→</span></a>
      </>}
    </div>
    <BookGrid books={shelfBooks} onOpen={(book, event) => openDetail('public', { kind: 'persisted', bookId: book.id }, event.currentTarget)} selected={selected.length > 0} hasActiveBooks={activeBooks.length > 0} />
  </section>;
  return <>
    <div id="app-shell">
      {surface === 'public' ? (
        <main id="top" className="public-shelf">
          <PageFrame>
            <PublicHeader heading={publicHeading} categories={store.categories} selected={selected} toggle={togglePublicCategory} onOpenManagement={() => setSurface('management')} />
            {!selectedCategory && <PublicHero />}
            <StickyToc active={selectedCategory === '픽션'} title={publicCategoryLabel(selectedCategory ?? '픽션')} options={audienceFilterOptions} value={audienceFilter} onChange={setAudienceFilter}>{featuredShelf}</StickyToc>
          </PageFrame>
        </main>
      ) : (
        <ManagementWorkspace
          store={store}
          heading={managementHeading}
          onReturn={() => setSurface('public')}
          onOpen={(book, event) => openDetail('management', { kind: 'persisted', bookId: book.id }, event.currentTarget)}
          onNew={(event) => openDetail('management', { kind: 'create' }, event.currentTarget)}
          onImport={importCatalog}
          onExport={exportCatalog}
          onCreateCategory={(name) => { const next = categoryIdForLabel(name); if (!next || next === '보관' || store.categories.includes(next)) { announce('카테고리 이름을 사용할 수 없습니다.'); return false; } setCatalog((current) => ({ ...current, store: { ...current.store, categories: [...current.store.categories, next] } })); announce('카테고리를 만들었습니다.'); return true; }}
          onRename={(from, to) => mutateCategory('rename', from, to)}
          onDeleteCategory={(category, event) => openConfirm({ message: `‘${publicCategoryLabel(category)}’ 카테고리를 삭제할까요? 연결된 책에서는 제거됩니다.`, trigger: event.currentTarget, action: () => mutateCategory('delete', category) })}
          onDeleteBook={(book, event) => openConfirm({ message: `‘${book.title}’을(를) 영구 삭제할까요?`, trigger: event.currentTarget, action: () => { setCatalog((current) => ({ ...current, store: { ...current.store, books: current.store.books.filter((item) => item.id !== book.id) } })); announce('책을 영구 삭제했습니다.'); } })}
        />
      )}
    </div>
    <StatusNotice announcement={notice} />
    <AnimatePresence initial={false} mode="wait">
      {topLayer?.kind === 'detail' ? <BookDetailDialog key="detail" detail={topLayer.detail} store={store} categories={store.categories} updateBook={updateBook} updateBookCategories={updateBookCategories} close={() => setTopLayer(null)} opener={opener} /> : topLayer?.kind === 'confirm' ? <Confirm key="confirm" state={topLayer.confirm} close={() => setTopLayer(null)} /> : null}
    </AnimatePresence>
  </>;
}
function PageFrame({ children }: { children: React.ReactNode }) { return <div className="page-frame">{children}</div>; }
function PublicHeader({ heading, categories, selected, toggle, onOpenManagement }: { heading: React.RefObject<HTMLHeadingElement | null>; categories: string[]; selected: string[]; toggle: (category: string) => void; onOpenManagement: () => void }) {
  return <header className="public-header">
    <div className="public-header-primary">
      <div className="public-header-brand"><img className="public-header-logo" src={choiceMakerLogo} alt="The ChoiceMaker Korea" /><h1 ref={heading} tabIndex={-1}>The ChoiceMaker Korea</h1></div>
      <div className="public-header-actions">{adminDemoEnabled && <button className="admin-entry" onClick={onOpenManagement}><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="3" /><path d="M5.5 19c.8-3.2 3-4.8 6.5-4.8s5.7 1.6 6.5 4.8" /></svg>관리자 데모</button>}</div>
    </div>
    <nav className="public-category-navigation" aria-label="도서 카테고리"><ShelfControls categories={categories} selected={selected} toggle={toggle} /></nav>
  </header>;
}
function PublicHero() {
  const reduceMotion = useReducedMotion() ?? false;
  const headingTransition = { duration: 0.36, ease: 'easeOut' as const };
  return <section className="public-hero" aria-labelledby="public-hero-heading">
    <div className="public-hero-copy">
      <motion.h2 id="public-hero-heading" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} transition={reduceMotion ? undefined : headingTransition}>Curated Stories.<br />Worldwide Impact.</motion.h2>
      <p className="public-hero-subtitle">The ChoiceMaker Korea<br />2026 Frankfurt BookFair Exhibit Titles</p>
      <a className="public-hero-cta" href="#featured-titles">Explore Our Portfolio <span aria-hidden="true">→</span></a>
    </div>
    <img className="public-hero-image" src={editorialHero} alt="The ChoiceMaker Korea의 어린이 책 컬렉션" />
  </section>;
}
function ShelfControls({ categories, selected, toggle }: { categories: string[]; selected: string[]; toggle: (category: string) => void }) { return <div className="filters" role="group" aria-label="카테고리 필터">{categories.filter((category) => category !== '보관').map((category) => { const active = selected.includes(category); return <button key={category} className={active ? 'active' : ''} aria-pressed={active} onClick={() => toggle(category)}>{publicCategoryLabel(category)}</button>; })}</div>; }
function BookGrid({ books, onOpen, selected, hasActiveBooks }: { books: Book[]; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; selected: boolean; hasActiveBooks: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const panelTransition = { duration: 0.28, ease: 'easeOut' as const };
  const booksKey = books.map((book) => book.id).join(',');
  return <AnimatePresence initial={false} mode="wait">
    {books.length ? <motion.section key={`books:${booksKey}`} className="grid" aria-label="책 목록" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : panelTransition}>
      {books.map((book) => {
        const credits = [book.author, book.illustrator && book.illustrator !== '없음' ? book.illustrator : '', book.publisher].filter((value): value is string => typeof value === 'string' && value.trim() !== '');
        return <div key={book.id} className="book-card-shell">
          <button
            className="book-card"
            data-book-id={book.id}
            onClick={(event) => onOpen(book, event)}
          >
            <BookCover book={book} />
            <span className="book-card-copy">
              <span className="category">{book.categories.filter((item) => item !== '보관').map(publicCategoryLabel).join(' · ')}</span>
              <strong>{book.seriesId && Number.isFinite(book.seriesNumber) ? book.seriesTitle || book.english || book.title : book.english || book.title}</strong>
              <small className="book-creators">{credits.map((credit, index) => <span key={`${credit}-${index}`}>{credit}</span>)}</small>
            </span>
          </button>
          {soldRightsPosition1BookIds.has(book.id) && <img className="book-rights-note book-rights-note-position-1" data-rights-note-position="1" src={stickyNotePosition1} alt="Sold rights: Starry Cat Village 4" />}
        </div>;
      })}
    </motion.section> : <motion.p key="empty" className="empty" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : panelTransition}>{hasActiveBooks && selected ? '이 카테고리에 공개된 책이 없습니다' : '현재 공개된 책이 없습니다'}</motion.p>}
  </AnimatePresence>;
}
function BookCover({ book }: { book: Book }) {
  useCoverAnalysis(book.cover);
  const awards = book.awards ?? [];
  const rightsSold = book.rightsSold ?? [];
  const hasMetadata = awards.length > 0 || rightsSold.length > 0;
  return <span className="cover-frame">
    <img className="book-cover" src={book.cover} alt="" loading="lazy" style={{ objectFit: resolvedCoverFit(book) }} />
    <span className="book-card-overlay" aria-hidden="true">
      {!hasMetadata ? <img className="book-overlay-empty-icon" src={moonFogIcon} alt="" /> : <>
        {awards.length > 0 && <>
          <span className="book-overlay-award-icons">{awards.map((award, index) => <img key={`${award}-${index}`} className="book-overlay-award-icon" src={awardIcon} alt="" />)}</span>
          <span className="book-overlay-section">
            <span className="book-overlay-heading">수상목록</span>
            <span className="book-overlay-list">{awards.map((award) => <span key={award}>- {award}</span>)}</span>
          </span>
        </>}
        {rightsSold.length > 0 && <span className="book-overlay-rights">
          <span className="book-overlay-heading">Rights Sold</span>
          <span className="book-overlay-list">{rightsSold.map((language) => <span key={language}>- {language}</span>)}</span>
        </span>}
      </>}
    </span>
  </span>;
}

function ManagementWorkspace({ store, heading, onReturn, onOpen, onNew, onImport, onExport, onCreateCategory, onRename, onDeleteCategory, onDeleteBook }: { store: Store; heading: React.RefObject<HTMLHeadingElement | null>; onReturn: () => void; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; onNew: (event: React.MouseEvent<HTMLButtonElement>) => void; onImport: (file: File) => void; onExport: () => void; onCreateCategory: (name: string) => boolean; onRename: (from: string, to: string) => boolean; onDeleteCategory: (category: string, event: React.MouseEvent<HTMLButtonElement>) => void; onDeleteBook: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [coverFilter, setCoverFilter] = useState<'all' | 'review' | 'exception'>('all');
  const importInput = useRef<HTMLInputElement>(null);
  const active = store.books.filter((book) => !book.categories.includes('보관'));
  const archived = store.books.filter((book) => book.categories.includes('보관'));
  return <main className="management-workspace"><PageFrame>
    <div className="workspace-top"><div><p className="eyebrow">ADMIN DEMO · LOCAL ONLY</p><h1 ref={heading} tabIndex={-1}>서가 관리</h1><p className="demo">데모 인증 및 브라우저 localStorage 저장입니다. 실제 권한이나 서버 보안이 아닙니다.</p></div><button onClick={onReturn}>공개 서가 보기</button></div>
    <ManagementSection title="카탈로그 데이터">
      <p>스키마에 맞는 JSON의 새 ID만 추가합니다. 중복 ID가 하나라도 있으면 아무것도 반영하지 않습니다. 내보낸 파일을 <code>src/books.json</code>에 반영하고 커밋한 뒤 배포해야 공개 카탈로그에 적용됩니다.</p>
      <input ref={importInput} className="sr-only" type="file" accept=".json,application/json" aria-label="카탈로그 JSON 파일" onChange={(event) => { const [file] = Array.from(event.target.files ?? []); event.target.value = ''; if (file) onImport(file); }} />
      <button type="button" onClick={() => importInput.current?.click()}>카탈로그 JSON 가져오기</button>
      <button type="button" onClick={onExport}>카탈로그 JSON 내보내기</button>
    </ManagementSection>
    <ManagementSection title="책 관리" section="active"><button onClick={onNew}>새 책 추가</button><fieldset className="cover-status-filter"><legend>자동 표지 상태 필터</legend>{([['all', '전체'], ['review', '검토 필요'], ['exception', '예외']] as const).map(([value, label]) => <label key={value}><input type="radio" name="cover-status-filter" value={value} checked={coverFilter === value} onChange={() => setCoverFilter(value)} />{label}</label>)}</fieldset><BookRows books={active} archived={false} coverFilter={coverFilter} onOpen={onOpen} /></ManagementSection>
    <ManagementSection title="카테고리 관리"><form className="category-create" onSubmit={(event: FormEvent) => { event.preventDefault(); if (onCreateCategory(name)) setName(''); }}><input aria-label="새 카테고리" value={name} onChange={(event) => setName(event.target.value)} placeholder="새 카테고리" /><button>추가</button></form><ul className="manage-list">{store.categories.map((category) => <li key={category}><span>{publicCategoryLabel(category)}{category === '보관' && ' (예약됨)'}</span>{category !== '보관' && (renaming === category ? <form className="inline-rename" onSubmit={(event) => { event.preventDefault(); if (onRename(category, rename)) setRenaming(null); }}><input aria-label={`${publicCategoryLabel(category)} 새 이름`} value={rename} onChange={(event) => setRename(event.target.value)} /><button>저장</button><button type="button" onClick={() => setRenaming(null)}>취소</button></form> : <><button onClick={() => { setRenaming(category); setRename(publicCategoryLabel(category)); }}>이름 변경</button><button className="danger" onClick={(event) => onDeleteCategory(category, event)}>삭제</button></>)}</li>)}</ul></ManagementSection>
    <ManagementSection title="보관된 책" section="archived"><BookRows books={archived} archived onOpen={onOpen} onDelete={onDeleteBook} /></ManagementSection>
  </PageFrame></main>;
}
function ManagementSection({ title, section, children }: { title: string; section?: 'active' | 'archived'; children: React.ReactNode }) { return <section className="management-section"><h2 data-management-section={section} tabIndex={-1}>{title}</h2>{children}</section>; }
function CoverStatus({ book, analysis }: { book: Book; analysis: CoverAnalysis }) {
  const fit = resolvedCoverFit(book);
  const label = analysis.status === 'loading' ? '분석 중' : analysis.status === 'unavailable' ? '이미지 분석 불가' : analysis.status === 'safe' ? '안전' : analysis.status === 'review' ? '검토 필요' : '예외';
  return <span className={`cover-status cover-status-${analysis.status}`}><b>{label}</b>{analysis.cropFraction !== undefined && <> · 예상 잘림 {Math.round(analysis.cropFraction * 100)}%</>}<small>{normalizeCoverFit(book.coverFit) === 'auto' ? `자동 표시: ${fit}` : `표시: ${fit}`}</small></span>;
}
function CoverRow({ book, archived, coverFilter, onOpen, onDelete }: { book: Book; archived: boolean; coverFilter: 'all' | 'review' | 'exception'; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; onDelete?: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const analysis = useCoverAnalysis(book.cover);
  const matches = coverFilter === 'all' || (coverFilter === 'review' ? analysis.status === 'review' || analysis.status === 'exception' || analysis.status === 'unavailable' : analysis.status === 'exception');
  if (!matches) return null;
  return <li><span>{book.title} {archived && <b>보관됨</b>}<CoverStatus book={book} analysis={analysis} /></span><button data-book-id={book.id} onClick={(event) => onOpen(book, event)}>{archived ? '보기 및 복원' : '편집'}</button>{archived ? <button className="danger" onClick={(event) => onDelete?.(book, event)}>영구 삭제</button> : <button disabled title="먼저 보관해야 삭제할 수 있습니다.">영구 삭제</button>}</li>;
}
function BookRows({ books, archived, coverFilter = 'all', onOpen, onDelete }: { books: Book[]; archived: boolean; coverFilter?: 'all' | 'review' | 'exception'; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; onDelete?: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void }) { return <ul className="manage-list">{books.map((book) => <CoverRow key={book.id} book={book} archived={archived} coverFilter={coverFilter} onOpen={onOpen} onDelete={onDelete} />)}</ul>; }


function BookDetailDialog({ detail, store, categories, updateBook, updateBookCategories, close, opener }: { detail: DetailState; store: Store; categories: string[]; updateBook: (book: Book) => void; updateBookCategories: (bookId: string, updateCategories: (categories: string[]) => string[]) => void; close: () => void; opener: React.MutableRefObject<HTMLElement | null> }) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const choiceCancel = useRef<HTMLButtonElement>(null);
  const inverse = useRef<HTMLButtonElement>(null);
  const restoreInverseFocus = useRef(false);
  const previousPhase = useRef<DetailPhase | null>(null);
  const choiceHadFocus = useRef(false);
  const popupSwipe = useRef<{ pointerId: number; x: number; y: number; time: number; active: boolean } | null>(null);
  const popupWheel = useRef({ offset: 0, time: 0, releaseAt: 0 });
  const seriesNavigationReleaseAt = useRef(0);
  const seriesBoundaryReset = useRef<number | null>(null);
  const contentReturnFrame = useRef<number | null>(null);
  const titleId = useId();
  const phaseTitleId = useId();
  const reduceMotion = useReducedMotion() ?? false;
  const [local, setLocal] = useState<DetailState>(() => {
    if (detail.identity.kind !== 'create') return detail;
    const draft: Book = { id: crypto.randomUUID(), title: '새 책', english: 'New Book', author: '', illustrator: '', categories: [], cover: makeCover('새 책'), introSource: 'ADMIN', awards: [], rightsSold: [] };
    return { ...detail, phase: 'edit', baseline: copy(draft), draft };
  });
  const [status, announce] = useAnnouncer();
  const [seriesBoundaryNudge, setSeriesBoundaryNudge] = useState(0);
  const live = local.identity.kind === 'persisted' ? store.books.find((book) => book.id === local.identity.bookId) : undefined;
  const book = live ?? local.draft;
  const fallback = () => {
    const bookId = local.identity.kind === 'persisted' ? local.identity.bookId : null;
    const currentBook = bookId ? store.books.find((item) => item.id === bookId) : undefined;
    const section = currentBook?.categories.includes('보관') ? 'archived' : 'active';
    return opener.current?.isConnected ? opener.current : (bookId ? document.querySelector<HTMLElement>(`button[data-book-id="${bookId}"]`) : null) ?? document.querySelector<HTMLElement>(`h2[data-management-section="${section}"]`) ?? document.querySelector<HTMLElement>('.workspace-top h1');
  };
  const dirty = Boolean(local.baseline && local.draft && JSON.stringify(local.baseline) !== JSON.stringify(local.draft));
  const seriesBooks = book && local.audience === 'public' && local.phase === 'read' && book.seriesId && Number.isFinite(book.seriesNumber) ? store.books.filter((item) => !item.categories.includes('보관') && item.seriesId === book.seriesId && Number.isFinite(item.seriesNumber)).sort((left, right) => left.seriesNumber! - right.seriesNumber!) : [];
  const seriesIndex = book ? seriesBooks.findIndex((item) => item.id === book.id) : -1;
  const hasSeriesNavigation = local.audience === 'public' && local.phase === 'read' && seriesIndex >= 0 && seriesBooks.length > 1;
  const nudgeSeriesBoundary = (offset: number) => {
    if (reduceMotion) return;
    setSeriesBoundaryNudge(offset > 0 ? -10 : 10);
    if (seriesBoundaryReset.current !== null) window.clearTimeout(seriesBoundaryReset.current);
    seriesBoundaryReset.current = window.setTimeout(() => {
      setSeriesBoundaryNudge(0);
      seriesBoundaryReset.current = null;
    }, 110);
  };
  const cancelContentReturn = () => {
    if (contentReturnFrame.current !== null) window.cancelAnimationFrame(contentReturnFrame.current);
    contentReturnFrame.current = null;
  };
  const returnContentToTop = () => {
    const node = content.current;
    if (!node || node.scrollTop <= 0) return;
    cancelContentReturn();
    const from = node.scrollTop;
    if (reduceMotion) {
      node.scrollTop = 0;
      return;
    }
    const duration = Math.min(280, Math.max(220, from * .18));
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      node.scrollTop = from * (1 - eased);
      if (progress < 1) contentReturnFrame.current = window.requestAnimationFrame(tick);
      else contentReturnFrame.current = null;
    };
    contentReturnFrame.current = window.requestAnimationFrame(tick);
  };
  const changeSeriesVolume = (offset: number) => {
    const now = performance.now();
    if (now < seriesNavigationReleaseAt.current) return;
    const next = seriesBooks[seriesIndex + offset];
    if (!next) {
      nudgeSeriesBoundary(offset);
      return;
    }
    seriesNavigationReleaseAt.current = now + seriesNavigationCooldown;
    returnContentToTop();
    setLocal((current) => current.identity.kind === 'persisted' ? { ...current, identity: { kind: 'persisted', bookId: next.id } } : current);
  };
  const isSeriesVolumeTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('.series-volume-section'));
  const handlePopupPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    cancelContentReturn();
    if (event.button !== 0 || isSeriesVolumeTarget(event.target)) return;
    popupSwipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, active: false };
  };
  const handlePopupPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = popupSwipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const offsetX = event.clientX - gesture.x;
    const offsetY = event.clientY - gesture.y;
    if (!gesture.active) {
      if (Math.abs(offsetX) < 12 || Math.abs(offsetX) <= Math.abs(offsetY)) return;
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  };
  const finishPopupSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = popupSwipe.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    popupSwipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.active) return;
    const offsetX = event.clientX - gesture.x;
    const velocityX = offsetX / Math.max(1, event.timeStamp - gesture.time);
    event.preventDefault();
    if (Math.abs(offsetX) >= 48 || Math.abs(velocityX) >= .5) changeSeriesVolume(offsetX < 0 ? 1 : -1);
  };
  const cancelPopupSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (popupSwipe.current?.pointerId !== event.pointerId) return;
    popupSwipe.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handlePopupWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (isSeriesVolumeTarget(event.target)) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      cancelContentReturn();
      return;
    }
    const offset = event.deltaX > 0 ? 1 : -1;
    if (seriesBooks.length < 2) return;
    event.preventDefault();
    const now = event.timeStamp;
    if (now - popupWheel.current.time > 120) popupWheel.current.offset = 0;
    popupWheel.current.time = now;
    if (now < popupWheel.current.releaseAt) return;
    popupWheel.current.offset += event.deltaX;
    if (Math.abs(popupWheel.current.offset) < 48) return;
    popupWheel.current.offset = 0;
    popupWheel.current.releaseAt = now + 260;
    changeSeriesVolume(offset);
  };
  const requestClose = () => { if (local.audience === 'management' && dirty) setLocal({ ...local, phase: 'confirm-close' }); else close(); };
  const choicePhase = local.phase === 'resolve-dirty' || local.phase === 'confirm-lifecycle' || local.phase === 'confirm-close';
  ModalInteractionCoordinator(true, root, closeButton, requestClose, fallback);
  useEffect(() => () => {
    if (seriesBoundaryReset.current !== null) window.clearTimeout(seriesBoundaryReset.current);
    cancelContentReturn();
  }, []);
  useEffect(() => {
    const previous = previousPhase.current;
    const previouslyChoice = previous === 'resolve-dirty' || previous === 'confirm-lifecycle' || previous === 'confirm-close';
    previousPhase.current = local.phase;
    if (choicePhase) {
      const frame = requestAnimationFrame(() => choiceCancel.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (!previouslyChoice || !choiceHadFocus.current || restoreInverseFocus.current) return;
    const frame = requestAnimationFrame(() => {
      if (!restoreInverseFocus.current) closeButton.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [choicePhase, local.phase]);
  useEffect(() => {
    if (!restoreInverseFocus.current || local.phase !== 'read') return;
    let settledFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      settledFrame = requestAnimationFrame(() => {
        if (!restoreInverseFocus.current) return;
        inverse.current?.focus();
        restoreInverseFocus.current = false;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (settledFrame !== undefined) cancelAnimationFrame(settledFrame);
    };
  }, [local.phase]);
  if (!book) return <motion.div className="overlay" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : { duration: 0.16, ease: 'easeOut' }}><motion.div className="dialog" ref={root} role="dialog" aria-modal="true" aria-labelledby={phaseTitleId} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 4 }} transition={reduceMotion ? undefined : { duration: 0.2, ease: 'easeOut' }}><div className="dialog-header"><button className="close" ref={closeButton} onClick={close} aria-label="상세 닫기">닫기</button></div><div className="dialog-content"><StatusNotice announcement={status} /><DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title="책을 찾을 수 없습니다" text="이 책은 더 이상 서가에 없습니다." onCancel={close} actions={[]} /></div></motion.div></motion.div>;
  const archived = book.categories.includes('보관');
  const startEdit = () => setLocal({ ...local, phase: 'edit', baseline: copy(book), draft: copy(book) });
  const save = () => { const draft = local.draft; if (!draft) return; updateBook(draft); const identity: DetailIdentity = { kind: 'persisted', bookId: draft.id }; setLocal({ ...local, identity, phase: 'read', baseline: undefined, draft: undefined }); announce('책 정보를 저장했습니다.'); };
  const lifecycle = () => {
    if (local.identity.kind !== 'persisted' || !local.lifecycle) return;
    const intent = local.lifecycle;
    updateBookCategories(local.identity.bookId, (currentCategories) => intent === 'archive' ? [...currentCategories.filter((item) => item !== '보관'), '보관'] : currentCategories.filter((item) => item !== '보관'));
    restoreInverseFocus.current = true;
    setLocal((current) => ({ ...current, phase: 'read', lifecycle: null }));
    announce(intent === 'archive' ? '책을 보관했습니다.' : '책을 복원했습니다.');
  };
  const requestLifecycle = (intent: LifecycleIntent) => { if (dirty) setLocal({ ...local, phase: 'resolve-dirty', lifecycle: intent }); else setLocal({ ...local, phase: 'confirm-lifecycle', lifecycle: intent }); };
  const setDraft = (field: keyof Book, value: string | string[]) => setLocal((current) => current.draft ? { ...current, draft: { ...current.draft, [field]: value } } : current);
  return <motion.div className="overlay" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : { duration: 0.16, ease: 'easeOut' }}><motion.div className="dialog" ref={root} role="dialog" aria-modal="true" aria-labelledby={local.phase === 'read' ? titleId : phaseTitleId} onFocusCapture={(event) => { choiceHadFocus.current = event.target instanceof HTMLElement && Boolean(event.target.closest('.dialog-choice')); }} onPointerDown={handlePopupPointerDown} onPointerMove={handlePopupPointerMove} onPointerUp={finishPopupSwipe} onPointerCancel={cancelPopupSwipe} onWheel={handlePopupWheel} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 4 }} transition={reduceMotion ? undefined : { duration: 0.2, ease: 'easeOut' }}><div className="dialog-header"><button className="close" ref={closeButton} onClick={requestClose} aria-label="상세 닫기">닫기</button></div><><div className="dialog-content" ref={content}><StatusNotice announcement={status} />{local.phase === 'resolve-dirty' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title="변경 사항 처리" text="보관 또는 복원 전에 변경 사항을 저장하거나 폐기해야 합니다." onCancel={() => setLocal({ ...local, phase: 'edit', lifecycle: null })} actions={[['저장 후 계속', () => { save(); setLocal((current) => ({ ...current, phase: 'confirm-lifecycle', lifecycle: local.lifecycle })); }], ['폐기 후 계속', () => setLocal({ ...local, phase: 'confirm-lifecycle', baseline: undefined, draft: undefined })]]} /> : local.phase === 'confirm-lifecycle' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title={local.lifecycle === 'archive' ? '책 보관' : '책 복원'} text={local.lifecycle === 'archive' ? '이 책을 보관할까요?' : '이 책을 공개 서가로 복원할까요?'} onCancel={() => setLocal({ ...local, phase: 'read', lifecycle: null })} actions={[[local.lifecycle === 'archive' ? '보관' : '복원', lifecycle]]} /> : local.phase === 'confirm-close' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title="변경 사항 폐기" text="저장하지 않은 변경 사항을 폐기하고 닫을까요?" onCancel={() => setLocal({ ...local, phase: 'edit' })} actions={[['폐기하고 닫기', close]]} /> : local.phase === 'edit' && local.draft ? <EditView titleId={phaseTitleId} book={local.draft} categories={categories} setDraft={setDraft} save={save} discard={() => local.identity.kind === 'create' ? close() : setLocal({ ...local, phase: 'read', baseline: undefined, draft: undefined })} canManageLifecycle={local.identity.kind === 'persisted'} requestLifecycle={() => requestLifecycle(archived ? 'restore' : 'archive')} lifecycleLabel={archived ? '복원' : '보관'} /> : <>{hasSeriesNavigation ? <SeriesDetailTransition book={book} titleId={titleId} seriesBooks={seriesBooks} seriesIndex={seriesIndex} onChangeSeriesVolume={changeSeriesVolume} boundaryNudge={seriesBoundaryNudge} reduceMotion={reduceMotion} /> : <ReadView book={book} titleId={titleId} seriesBooks={seriesBooks} seriesIndex={seriesIndex} onChangeSeriesVolume={changeSeriesVolume} />}{local.audience === 'management' && <div className="dialog-actions"><button onClick={startEdit}>편집</button><button ref={inverse} onClick={() => requestLifecycle(archived ? 'restore' : 'archive')}>{archived ? '복원' : '보관'}</button></div>}</>}</div>{local.audience === 'public' && local.phase === 'read' && seriesIndex >= 0 && seriesBooks.length > 1 && <SeriesNavigationArrows seriesBooks={seriesBooks} seriesIndex={seriesIndex} onChangeSeriesVolume={changeSeriesVolume} />}</></motion.div></motion.div>;
}
function SeriesDetailTransition({ book, titleId, seriesBooks, seriesIndex, onChangeSeriesVolume, boundaryNudge, reduceMotion }: { book: Book; titleId: string; seriesBooks: Book[]; seriesIndex: number; onChangeSeriesVolume: (offset: number) => void; boundaryNudge: number; reduceMotion: boolean }) {
  const boundaryTransition = { type: 'spring' as const, stiffness: 420, damping: 28 };
  return <motion.div className="series-detail-stage" data-boundary-feedback={boundaryNudge ? 'active' : undefined} animate={reduceMotion ? undefined : { x: boundaryNudge }} transition={boundaryTransition}>
    <ReadView book={book} titleId={titleId} seriesBooks={seriesBooks} seriesIndex={seriesIndex} onChangeSeriesVolume={onChangeSeriesVolume} />
  </motion.div>;
}
function SeriesNavigationArrows({ seriesBooks, seriesIndex, onChangeSeriesVolume }: { seriesBooks: Book[]; seriesIndex: number; onChangeSeriesVolume: (offset: number) => void }) {
  const reduceMotion = useReducedMotion() ?? false;
  const transition = { type: 'spring' as const, duration: 0.3, bounce: 0 };
  const arrow = (direction: 'previous' | 'next', offset: number) => {
    const nextBook = seriesBooks[seriesIndex + offset];
    if (!nextBook) return null;
    const x = direction === 'previous' ? -8 : 8;
    const hoverX = direction === 'previous' ? 3 : -3;
    return <div className={`series-navigation-arrow-slot series-navigation-arrow-slot-${direction}`}>
      <AnimatePresence>{<motion.button key={direction} type="button" className="series-navigation-arrow" aria-label={`${direction === 'previous' ? '이전 권' : '다음 권'}: ${nextBook.title}`} initial={reduceMotion ? false : { opacity: 0, x, filter: 'blur(4px)' }} animate={reduceMotion ? undefined : { opacity: 1, x: 0, filter: 'blur(0px)' }} exit={reduceMotion ? undefined : { opacity: 0, x: x / 2, filter: 'blur(4px)' }} transition={transition} whileHover={reduceMotion ? undefined : { x: hoverX }} whileTap={reduceMotion ? undefined : { scale: 0.96 }} onPointerDown={(event) => event.stopPropagation()} onClick={() => onChangeSeriesVolume(offset)}><SeriesNavigationIcon direction={direction} /></motion.button>}</AnimatePresence>
    </div>;
  };
  return <div className="series-navigation-arrows">{arrow('previous', -1)}{arrow('next', 1)}</div>;
}
function SeriesNavigationIcon({ direction }: { direction: 'previous' | 'next' }) {
  const paths = direction === 'previous' ? [<path key="outer" d="M12.5303 4.53033C12.8232 4.23744 12.8232 3.76256 12.5303 3.46967C12.2374 3.17678 11.7626 3.17678 11.4697 3.46967L3.46967 11.4697C3.17678 11.7626 3.17678 12.2374 3.46967 12.5303L11.4697 20.5303C11.7626 20.8232 12.2374 20.8232 12.5303 20.5303C12.8232 20.2374 12.8232 19.7626 12.5303 19.4697L5.06066 12L12.5303 4.53033Z" />, <path key="inner" d="M20.5303 4.53033C20.8232 4.23744 20.8232 3.76256 20.5303 3.46967C20.2374 3.17678 19.7626 3.17678 19.4697 3.46967L11.4697 11.4697C11.1768 11.7626 11.1768 12.2374 11.4697 12.5303L19.4697 20.5303C19.7626 20.8232 20.2374 20.8232 20.5303 20.5303C20.8232 20.2374 20.8232 19.7626 20.5303 19.4697L13.0607 12L20.5303 4.53033Z" />] : [<path key="outer" d="M11.4697 4.53033C11.1768 4.23744 11.1768 3.76256 11.4697 3.46967C11.7626 3.17678 12.2374 3.17678 12.5303 3.46967L20.5303 11.4697C20.8232 11.7626 20.8232 12.2374 20.5303 12.5303L12.5303 20.5303C12.2374 20.8232 11.7626 20.8232 11.4697 20.5303C11.1768 20.2374 11.1768 19.7626 11.4697 19.4697L18.9393 12L11.4697 4.53033Z" />, <path key="inner" d="M3.46967 4.53033C3.17678 4.23744 3.17678 3.76256 3.46967 3.46967C3.76256 3.17678 4.23744 3.17678 4.53033 3.46967L12.5303 11.4697C12.8232 11.7626 12.8232 12.2374 12.5303 12.5303L4.53033 20.5303C4.23744 20.8232 3.76256 20.8232 3.46967 20.5303C3.17678 20.2374 3.17678 19.7626 3.46967 19.4697L10.9393 12L3.46967 4.53033Z" />];
  return <svg className="series-navigation-arrow-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{paths}</svg>;
}
function DialogChoice({ titleId, cancelRef, title, text, actions, onCancel }: { titleId: string; cancelRef: React.RefObject<HTMLButtonElement | null>; title: string; text: string; actions: [string, () => void][]; onCancel: () => void }) { return <section className="dialog-choice"><h2 id={titleId}>{title}</h2><p>{text}</p><button ref={cancelRef} onClick={onCancel}>취소</button>{actions.map(([label, action]) => <button key={label} className="danger" onClick={action}>{label}</button>)}</section>; }
function splitIntoParagraphs(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) paragraphs.push(sentences.slice(index, index + 2).join(' '));
  return paragraphs;
}
function FittedDetailTitle({ id, title }: { id: string; title: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const node = heading.current;
    if (!node) return;
    let active = true;
    let frame = 0;
    let measuredWidth = 0;
    const fit = (force = false) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;
        const width = node.clientWidth;
        if (!force && width === measuredWidth && node.dataset.titleFit) return;
        measuredWidth = width;
        node.style.removeProperty('font-size');
        const sourceSize = Number.parseFloat(getComputedStyle(node).fontSize);
        if (!width || !sourceSize) return;
        const minimumSize = Math.min(minimumDetailTitleSize, sourceSize);
        node.style.fontSize = `${minimumSize}px`;
        const minimumWidth = node.scrollWidth;
        let nextSize = minimumSize;
        if (minimumWidth > width) {
          nextSize = Math.max(1, minimumSize * (width - 1) / minimumWidth);
        } else {
          let lower = minimumSize;
          let upper = sourceSize;
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = (lower + upper) / 2;
            node.style.fontSize = `${candidate}px`;
            if (node.scrollWidth <= width) lower = candidate;
            else upper = candidate;
          }
          nextSize = lower;
        }
        node.style.fontSize = `${nextSize}px`;
        node.dataset.titleFit = nextSize < sourceSize ? 'scaled' : 'default';
      });
    };
    const observer = new ResizeObserver(() => fit());
    observer.observe(node);
    void document.fonts?.ready.then(() => fit(true));
    fit(true);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [title]);
  return <h2 ref={heading} id={id} className="detail-title">{title}</h2>;
}
function ReadView({ book, titleId, seriesBooks, seriesIndex, onChangeSeriesVolume }: { book: Book; titleId: string; seriesBooks: Book[]; seriesIndex: number; onChangeSeriesVolume: (offset: number) => void }) {
  const credits = [
    ['글', book.author],
    ['그림', book.illustrator],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
  const publication = [
    ['출판사', book.publisher],
    ['추천 독자', book.recommendedAudience?.label],
    ['키워드', book.keywords],
    ['발행일', book.publishedAt],
    ['정가', book.listPrice ? `${book.listPrice.toLocaleString('ko-KR')}원` : undefined],
    ['ISBN', book.isbn],
    ['사양', book.specs],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
  const categories = book.categories.filter((item) => item !== '보관').map(publicCategoryLabel).join(' · ') || '분류 없음';
  const provenance = book.introSource === 'YES24_PARAPHRASE' ? 'Yes24 기반으로 운영자가 재구성한 소개 문구입니다.' : book.introSource === 'ADMIN' ? '운영자가 등록한 큐레이션 소개 문구입니다.' : '소개 출처가 확인되지 않았습니다.';
  const introParagraphs = book.intro ? splitIntoParagraphs(book.intro) : [];
  const introSection = book.intro && <section className="intro-section"><h3>책 소개와 줄거리</h3><div className="intro-copy">{introParagraphs.map((paragraph, index) => <p key={`${book.id}-intro-${index}`}>{paragraph}</p>)}</div><small className="detail-provenance">{provenance}</small></section>;
  const series = seriesIndex >= 0 && seriesBooks.length > 1;
  return <article className="book-detail">
    <div className="detail-spread">
      <div className="detail-hero">
        <img className="detail-cover" src={book.cover} alt={`${book.title} 표지`} />
      </div>
      <header className="detail-heading">
        <p className="detail-kicker">{categories}</p>
        <FittedDetailTitle id={titleId} title={book.title} />
        {book.english && <p className="detail-english">{book.english}</p>}
        {series && <p className="series-navigation" aria-live="polite" aria-atomic="true">{book.seriesTitle || book.seriesId} · {book.seriesNumber} / {seriesBooks.length}</p>}
      </header>
      <div className="detail-reading">
        {credits.length > 0 && <section className="detail-fact-group detail-credits"><h3>작가</h3><dl>{credits.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
        {introSection}
      </div>
    </div>
    {publication.length > 0 && <section className="detail-fact-group detail-publication detail-publication-section"><h3>책 정보</h3><dl>{publication.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    {((book.rightsSold?.length ?? 0) > 0 || (book.awards?.length ?? 0) > 0 || book.yes24Url || series) && <div className="detail-support">
      {(book.rightsSold?.length ?? 0) > 0 && <section className="rights-sold-section"><h3>Rights Sold</h3><ul className="detail-metadata-list">{book.rightsSold!.map((language) => <li key={language}>{language}</li>)}</ul></section>}
      {(book.awards?.length ?? 0) > 0 && <section><h3>수상 및 추천</h3><ul className="detail-metadata-list">{book.awards!.map((award) => <li key={award}>{award}</li>)}</ul></section>}
      {series && <SeriesVolumeSlider seriesBooks={seriesBooks} seriesIndex={seriesIndex} onChangeSeriesVolume={onChangeSeriesVolume} />}
      {book.yes24Url && <section className="source-section"><a href={book.yes24Url} target="_blank" rel="noreferrer">예스24에서 상세 정보 보기 ↗</a></section>}
    </div>}
  </article>;
}
function SeriesVolumeSlider({ seriesBooks, seriesIndex, onChangeSeriesVolume }: { seriesBooks: Book[]; seriesIndex: number; onChangeSeriesVolume: (offset: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean; points: { x: number; time: number }[] } | null>(null);
  const moved = useRef(false);
  const position = useRef(0);
  const renderFrame = useRef<number | null>(null);
  const motionFrame = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const maximumVelocity = 1.6;
  const clearIdleTimer = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  const stopMotion = () => {
    if (motionFrame.current !== null) window.cancelAnimationFrame(motionFrame.current);
    motionFrame.current = null;
  };
  const maximum = (node: HTMLDivElement) => Math.max(0, node.scrollWidth - node.clientWidth);
  const render = (next: number, overscroll = 0) => {
    const node = track.current;
    if (!node) return;
    position.current = Math.max(0, Math.min(maximum(node), next));
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      node.scrollLeft = position.current;
      node.style.transform = overscroll ? `translateX(${overscroll}px)` : '';
    });
  };
  const nearestCardPosition = (node: HTMLDivElement) => {
    const cards = Array.from(node.querySelectorAll<HTMLButtonElement>('.series-volume-card'));
    return cards.reduce((nearest, card) => Math.abs(card.offsetLeft - position.current) < Math.abs(nearest - position.current) ? card.offsetLeft : nearest, cards[0]?.offsetLeft ?? 0);
  };
  const settle = () => {
    const node = track.current;
    if (!node) return;
    stopMotion();
    const from = position.current;
    const target = Math.max(0, Math.min(maximum(node), nearestCardPosition(node)));
    const start = performance.now();
    const duration = reduceMotion ? 0 : 180;
    const tick = (now: number) => {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      render(from + (target - from) * eased);
      if (progress < 1) motionFrame.current = window.requestAnimationFrame(tick);
      else motionFrame.current = null;
    };
    motionFrame.current = window.requestAnimationFrame(tick);
  };
  const scheduleSettle = () => {
    clearIdleTimer();
    idleTimer.current = window.setTimeout(settle, reduceMotion ? 0 : 120);
  };
  const glide = (initialVelocity: number) => {
    const node = track.current;
    if (!node || reduceMotion) {
      settle();
      return;
    }
    stopMotion();
    let velocity = Math.max(-maximumVelocity, Math.min(maximumVelocity, initialVelocity));
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(32, now - previous);
      previous = now;
      const next = position.current + velocity * elapsed;
      const limit = maximum(node);
      if (next < 0 || next > limit) {
        const bounded = Math.max(0, Math.min(limit, next));
        render(bounded, Math.max(-36, Math.min(36, (bounded - next) * .28)));
        settle();
        return;
      }
      render(next);
      velocity -= Math.sign(velocity) * .003 * elapsed;
      if (Math.abs(velocity) <= .02) {
        settle();
        return;
      }
      motionFrame.current = window.requestAnimationFrame(tick);
    };
    motionFrame.current = window.requestAnimationFrame(tick);
  };
  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    stopMotion();
    clearIdleTimer();
  }, []);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    clearIdleTimer();
    stopMotion();
    moved.current = false;
    position.current = event.currentTarget.scrollLeft;
    event.currentTarget.style.transform = '';
    drag.current = { x: event.clientX, scrollLeft: position.current, moved: false, points: [{ x: event.clientX, time: event.timeStamp }] };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const delta = event.clientX - current.x;
    if (Math.abs(delta) >= 8) {
      if (!current.moved) event.currentTarget.setPointerCapture(event.pointerId);
      current.moved = true;
      moved.current = true;
    }
    current.points.push({ x: event.clientX, time: event.timeStamp });
    current.points = current.points.filter((point) => event.timeStamp - point.time <= 120);
    if (!current.moved) return;
    const next = current.scrollLeft - delta;
    const limit = maximum(event.currentTarget);
    const bounded = Math.max(0, Math.min(limit, next));
    render(bounded, Math.max(-42, Math.min(42, (bounded - next) * .35)));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    if (!current?.moved) return;
    const first = current.points[0];
    const last = current.points[current.points.length - 1];
    const velocity = first && last && last.time > first.time ? -(last.x - first.x) / (last.time - first.time) : 0;
    if (Math.abs(velocity) > .08) glide(velocity);
    else settle();
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    clearIdleTimer();
    stopMotion();
    const node = event.currentTarget;
    if (renderFrame.current === null) position.current = node.scrollLeft;
    const next = position.current + event.deltaX;
    const limit = maximum(node);
    const bounded = Math.max(0, Math.min(limit, next));
    render(bounded, Math.max(-28, Math.min(28, (bounded - next) * .2)));
    scheduleSettle();
  };
  return <section className="series-volume-section" aria-label="시리즈">
    <div className="series-volume-heading"><h3>시리즈</h3></div>
    <div className="series-volume-track" ref={track} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      {seriesBooks.map((volume, index) => <button key={volume.id} type="button" className="series-volume-card" aria-label={`${volume.seriesNumber}권 선택`} aria-current={index === seriesIndex ? 'true' : undefined} onClick={(event) => { event.stopPropagation(); if (!moved.current && index !== seriesIndex) onChangeSeriesVolume(index - seriesIndex); }}><img src={volume.cover} alt="" /></button>)}
    </div>
  </section>;
}
function EditView({ titleId, book, categories, setDraft, save, discard, canManageLifecycle, requestLifecycle, lifecycleLabel }: { titleId: string; book: Book; categories: string[]; setDraft: (field: keyof Book, value: string | string[]) => void; save: () => void; discard: () => void; canManageLifecycle: boolean; requestLifecycle: () => void; lifecycleLabel: string }) {
  const fields: (keyof Book)[] = ['title', 'english', 'author', 'illustrator', 'cover', 'intro', 'awards', 'rightsSold', 'isbn', 'specs', 'keywords'];
  const listFields = new Set<keyof Book>(['awards', 'rightsSold']);
  return <form className="editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <h2 id={titleId}>책 편집</h2>
    {fields.map((field) => {
      const value = book[field];
      return <label key={field}>{field}<textarea value={Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : ''} onChange={(event) => setDraft(field, listFields.has(field) ? event.target.value.split('\n') : event.target.value)} /></label>;
    })}
    <label className="cover-fit-select">표지 표시 방식<select value={normalizeCoverFit(book.coverFit)} onChange={(event) => setDraft('coverFit', event.target.value)}><option value="auto">자동</option><option value="cover">채우기 (cover)</option><option value="contain">맞춤 (contain)</option></select><small>자동은 프레임을 채우며, 검토·예외 상태는 여기서 표시 방식을 조정합니다.</small></label>
    <fieldset><legend>카테고리</legend>{categories.filter((item) => item !== '보관').map((category) => <label key={category}><input type="checkbox" checked={book.categories.includes(category)} onChange={() => setDraft('categories', book.categories.includes(category) ? book.categories.filter((item) => item !== category) : [...book.categories, category])} />{publicCategoryLabel(category)}</label>)}</fieldset>
    <button>저장</button><button type="button" onClick={discard}>변경 취소</button>{canManageLifecycle && <button type="button" onClick={requestLifecycle}>{lifecycleLabel}</button>}
  </form>;
}
function Confirm({ state, close }: { state: ConfirmState; close: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const label = useId();
  const description = useId();
  const reduceMotion = useReducedMotion() ?? false;
  ModalInteractionCoordinator(true, root, cancel, close, () => state.trigger?.isConnected ? state.trigger : document.querySelector<HTMLElement>('.workspace-top button, main button:not([disabled])'));
  return <motion.div className="confirm" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : { duration: 0.16, ease: 'easeOut' }}><motion.div ref={root} role="alertdialog" aria-modal="true" aria-labelledby={label} aria-describedby={description} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 4 }} transition={reduceMotion ? undefined : { duration: 0.2, ease: 'easeOut' }}><h2 id={label}>확인</h2><p id={description}>{state.message}</p><button ref={cancel} onClick={close}>취소</button><button className="danger" onClick={() => { state.action(); close(); }}>확인</button></motion.div></motion.div>;
}
createRoot(document.getElementById('root')!).render(<App />);
