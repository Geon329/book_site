import { FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import booksData from './books.json';
import choiceMakerLogo from '../ChoiceMaker new logo.jpg';

type Book = { id: string; title: string; english: string; author: string; illustrator: string; publisher?: string; categories: string[]; cover: string; intro?: string; introSource?: 'YES24_PARAPHRASE' | 'ADMIN'; awards?: string; isbn?: string; specs?: string; keywords?: string; publishedAt?: string; listPrice?: number; yes24Url?: string };
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
const catalogVersion = 4;
const schemaVersion = 1;
type CatalogDocument = { schemaVersion: number; catalogVersion: number; categories: string[]; books: Book[] };
type PersistedStore = Store & { sourceFingerprint?: string };
const makeCover = (title: string, color: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="${color}"/><rect x="38" y="38" width="524" height="724" fill="none" stroke="#ffffff" stroke-opacity=".45"/><text x="72" y="610" fill="#ffffff" font-family="Georgia,serif" font-size="36">${title}</text><text x="72" y="678" fill="#ffffff" font-family="Arial,sans-serif" font-size="16" letter-spacing="4">BOOK MARGIN</text></svg>`)}`;
const minimumDetailTitleSize = 15;
const normalizeCategories = (categories: unknown[]) => [...new Set([...categories.filter((item): item is string => typeof item === 'string' && item.trim() !== '' && item !== '보관'), '보관'])];
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
function normalizeBook(book: Book, categories: string[]): Book {
  const safeCategories = Array.isArray(book.categories) ? [...new Set(book.categories.filter((item) => categories.includes(item)))] : [];
  const cover = typeof book.cover === 'string' && (book.cover.startsWith('data:image/svg+xml') || book.cover.startsWith('https://image.yes24.com/goods/')) ? book.cover : makeCover(book.title || '책', '#7b6d62');
  return { ...book, categories: safeCategories, cover };
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
    const categories = [...new Set([...parsed.categories.filter((item): item is string => typeof item === 'string' && item !== '보관'), '보관'])];
    const books = parsed.books
      .filter((item): item is Book => Boolean(item && typeof item === 'object' && typeof item.id === 'string'))
      .map((item) => normalizeBook(migrateSeedContent(item, loadedVersion), categories));
    return { catalogVersion, categories, books };
  } catch {
    return initial;
  }
}
const copy = (book: Book): Book => ({ ...book, categories: [...book.categories] });
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
    const next = to.trim();
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
  const activeBooks = store.books.filter((book) => !book.categories.includes('보관'));
  const visible = activeBooks.filter((book) => !selected.length || book.categories.some((category) => selected.includes(category)));
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
  return <>
    <div id="app-shell">
      {surface === 'public' ? (
        <main className="public-shelf">
          <PageFrame>
            <PublicIntro heading={publicHeading} />
            <div className="utility-row"><button className="admin-entry" onClick={() => setSurface('management')}>관리자 데모</button></div>
            <ShelfControls categories={store.categories} selected={selected} toggle={(category) => setCatalog((current) => ({ ...current, selectedCategories: current.selectedCategories.includes(category) ? current.selectedCategories.filter((item) => item !== category) : [...current.selectedCategories, category] }))} />
            <BookGrid books={visible} onOpen={(book, event) => openDetail('public', { kind: 'persisted', bookId: book.id }, event.currentTarget)} selected={selected.length > 0} hasActiveBooks={activeBooks.length > 0} />
            <ShelfFooter />
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
          onCreateCategory={(name) => { const next = name.trim(); if (!next || next === '보관' || store.categories.includes(next)) { announce('카테고리 이름을 사용할 수 없습니다.'); return false; } setCatalog((current) => ({ ...current, store: { ...current.store, categories: [...current.store.categories, next] } })); announce('카테고리를 만들었습니다.'); return true; }}
          onRename={(from, to) => mutateCategory('rename', from, to)}
          onDeleteCategory={(category, event) => openConfirm({ message: `‘${category}’ 카테고리를 삭제할까요? 연결된 책에서는 제거됩니다.`, trigger: event.currentTarget, action: () => mutateCategory('delete', category) })}
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
function PublicIntro({ heading }: { heading: React.RefObject<HTMLHeadingElement | null> }) {
  return <header className="shelf-intro">
    <img className="shelf-logo" src={choiceMakerLogo} alt="The ChoiceMaker Korea" />
    <h1 ref={heading} tabIndex={-1}>The ChoiceMaker Korea — Featured Books</h1>
    <span className="shelf-title-mark" aria-hidden="true" />
  </header>;
}
function ShelfFooter() {
  return <footer className="shelf-footer"><span className="shelf-footer-mark" aria-hidden="true" /><p>The ChoiceMaker Korea <span aria-hidden="true">·</span> Featured Books</p></footer>;
}
function ShelfControls({ categories, selected, toggle }: { categories: string[]; selected: string[]; toggle: (category: string) => void }) { return <div className="filters" role="group" aria-label="카테고리 필터">{categories.filter((category) => category !== '보관').map((category) => { const active = selected.includes(category); return <button key={category} className={active ? 'active' : ''} aria-pressed={active} onClick={() => toggle(category)}>{category}</button>; })}</div>; }
function BookGrid({ books, onOpen, selected, hasActiveBooks }: { books: Book[]; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; selected: boolean; hasActiveBooks: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const cardTransition = { duration: 0.22, ease: 'easeOut' as const };
  const panelTransition = { duration: 0.16, ease: 'easeOut' as const };
  return <AnimatePresence initial={false} mode="wait">
    {books.length ? <motion.section key="books" className="grid" aria-label="책 목록" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : panelTransition}>
      <AnimatePresence initial={false} mode="sync">
        {books.map((book) => {
          const creator = book.illustrator && book.illustrator !== '없음' ? `${book.author} · ${book.illustrator}` : book.author;
          return <motion.button
            key={book.id}
            className="book-card"
            layout={!reduceMotion ? 'position' : false}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={reduceMotion ? undefined : cardTransition}
            whileHover={reduceMotion ? undefined : { y: -3 }}
            onClick={(event) => onOpen(book, event)}
          >
            <BookCover book={book} />
            <span className="book-card-copy">
              <span className="category">{book.categories.filter((item) => item !== '보관').join(' · ')}</span>
              <strong>{book.title}</strong>
              <em>{book.english}</em>
              <small className="book-creators">{creator} · {book.publisher}</small>
            </span>
          </motion.button>;
        })}
      </AnimatePresence>
    </motion.section> : <motion.p key="empty" className="empty" initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : panelTransition}>{hasActiveBooks && selected ? '이 카테고리에 공개된 책이 없습니다' : '현재 공개된 책이 없습니다'}</motion.p>}
  </AnimatePresence>;
}
function BookCover({ book }: { book: Book }) {
  const reduceMotion = useReducedMotion() ?? false;
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(Boolean(image.current?.complete));
  }, [book.cover]);
  return <span className="cover-frame"><motion.img ref={image} className="book-cover" src={book.cover} alt="" loading="lazy" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} initial={false} animate={{ opacity: reduceMotion || loaded ? 1 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }} /></span>;
}

function ManagementWorkspace({ store, heading, onReturn, onOpen, onNew, onImport, onExport, onCreateCategory, onRename, onDeleteCategory, onDeleteBook }: { store: Store; heading: React.RefObject<HTMLHeadingElement | null>; onReturn: () => void; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; onNew: (event: React.MouseEvent<HTMLButtonElement>) => void; onImport: (file: File) => void; onExport: () => void; onCreateCategory: (name: string) => boolean; onRename: (from: string, to: string) => boolean; onDeleteCategory: (category: string, event: React.MouseEvent<HTMLButtonElement>) => void; onDeleteBook: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState('');
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
    <ManagementSection title="책 관리" section="active"><button onClick={onNew}>새 책 추가</button><BookRows books={active} archived={false} onOpen={onOpen} /></ManagementSection>
    <ManagementSection title="카테고리 관리"><form className="category-create" onSubmit={(event: FormEvent) => { event.preventDefault(); if (onCreateCategory(name)) setName(''); }}><input aria-label="새 카테고리" value={name} onChange={(event) => setName(event.target.value)} placeholder="새 카테고리" /><button>추가</button></form><ul className="manage-list">{store.categories.map((category) => <li key={category}><span>{category}{category === '보관' && ' (예약됨)'}</span>{category !== '보관' && (renaming === category ? <form className="inline-rename" onSubmit={(event) => { event.preventDefault(); if (onRename(category, rename)) setRenaming(null); }}><input aria-label={`${category} 새 이름`} value={rename} onChange={(event) => setRename(event.target.value)} /><button>저장</button><button type="button" onClick={() => setRenaming(null)}>취소</button></form> : <><button onClick={() => { setRenaming(category); setRename(category); }}>이름 변경</button><button className="danger" onClick={(event) => onDeleteCategory(category, event)}>삭제</button></>)}</li>)}</ul></ManagementSection>
    <ManagementSection title="보관된 책" section="archived"><BookRows books={archived} archived onOpen={onOpen} onDelete={onDeleteBook} /></ManagementSection>
  </PageFrame></main>;
}
function ManagementSection({ title, section, children }: { title: string; section?: 'active' | 'archived'; children: React.ReactNode }) { return <section className="management-section"><h2 data-management-section={section} tabIndex={-1}>{title}</h2>{children}</section>; }
function BookRows({ books, archived, onOpen, onDelete }: { books: Book[]; archived: boolean; onOpen: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void; onDelete?: (book: Book, event: React.MouseEvent<HTMLButtonElement>) => void }) { return <ul className="manage-list">{books.map((book) => <li key={book.id}><span>{book.title} {archived && <b>보관됨</b>}</span><button data-book-id={book.id} onClick={(event) => onOpen(book, event)}>{archived ? '보기 및 복원' : '편집'}</button>{archived ? <button className="danger" onClick={(event) => onDelete?.(book, event)}>영구 삭제</button> : <button disabled title="먼저 보관해야 삭제할 수 있습니다.">영구 삭제</button>}</li>)}</ul>; }


function BookDetailDialog({ detail, store, categories, updateBook, updateBookCategories, close, opener }: { detail: DetailState; store: Store; categories: string[]; updateBook: (book: Book) => void; updateBookCategories: (bookId: string, updateCategories: (categories: string[]) => string[]) => void; close: () => void; opener: React.MutableRefObject<HTMLElement | null> }) {
  const root = useRef<HTMLDivElement>(null); const closeButton = useRef<HTMLButtonElement>(null); const choiceCancel = useRef<HTMLButtonElement>(null); const inverse = useRef<HTMLButtonElement>(null); const restoreInverseFocus = useRef(false); const previousPhase = useRef<DetailPhase | null>(null); const choiceHadFocus = useRef(false); const titleId = useId(); const phaseTitleId = useId();
  const reduceMotion = useReducedMotion() ?? false;
  const [local, setLocal] = useState<DetailState>(() => {
    if (detail.identity.kind !== 'create') return detail;
    const draft = { id: crypto.randomUUID(), title: '새 책', english: 'New Book', author: '', illustrator: '', categories: [], cover: makeCover('새 책', '#7b6d62'), introSource: 'ADMIN' as const };
    return { ...detail, phase: 'edit', baseline: copy(draft), draft };
  });
  const [status, announce] = useAnnouncer();
  const live = local.identity.kind === 'persisted' ? store.books.find((book) => book.id === local.identity.bookId) : undefined;
  const book = live ?? local.draft;
  const fallback = () => {
    const bookId = local.identity.kind === 'persisted' ? local.identity.bookId : null;
    const currentBook = bookId ? store.books.find((item) => item.id === bookId) : undefined;
    const section = currentBook?.categories.includes('보관') ? 'archived' : 'active';
    return opener.current?.isConnected ? opener.current : (bookId ? document.querySelector<HTMLElement>(`button[data-book-id="${bookId}"]`) : null) ?? document.querySelector<HTMLElement>(`h2[data-management-section="${section}"]`) ?? document.querySelector<HTMLElement>('.workspace-top h1');
  };
  const dirty = Boolean(local.baseline && local.draft && JSON.stringify(local.baseline) !== JSON.stringify(local.draft));
  const requestClose = () => { if (local.audience === 'management' && dirty) setLocal({ ...local, phase: 'confirm-close' }); else close(); };
  const choicePhase = local.phase === 'resolve-dirty' || local.phase === 'confirm-lifecycle' || local.phase === 'confirm-close';
  ModalInteractionCoordinator(true, root, closeButton, requestClose, fallback);
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
  return <motion.div className="overlay" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={reduceMotion ? undefined : { duration: 0.16, ease: 'easeOut' }}><motion.div className="dialog" ref={root} role="dialog" aria-modal="true" aria-labelledby={local.phase === 'read' ? titleId : phaseTitleId} onFocusCapture={(event) => { choiceHadFocus.current = event.target instanceof HTMLElement && Boolean(event.target.closest('.dialog-choice')); }} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 4 }} transition={reduceMotion ? undefined : { duration: 0.2, ease: 'easeOut' }}><div className="dialog-header"><button className="close" ref={closeButton} onClick={requestClose} aria-label="상세 닫기">닫기</button></div><div className="dialog-content"><StatusNotice announcement={status} />{local.phase === 'resolve-dirty' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title="변경 사항 처리" text="보관 또는 복원 전에 변경 사항을 저장하거나 폐기해야 합니다." onCancel={() => setLocal({ ...local, phase: 'edit', lifecycle: null })} actions={[['저장 후 계속', () => { save(); setLocal((current) => ({ ...current, phase: 'confirm-lifecycle', lifecycle: local.lifecycle })); }], ['폐기 후 계속', () => setLocal({ ...local, phase: 'confirm-lifecycle', baseline: undefined, draft: undefined })]]} /> : local.phase === 'confirm-lifecycle' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title={local.lifecycle === 'archive' ? '책 보관' : '책 복원'} text={local.lifecycle === 'archive' ? '이 책을 보관할까요?' : '이 책을 공개 서가로 복원할까요?'} onCancel={() => setLocal({ ...local, phase: 'read', lifecycle: null })} actions={[[local.lifecycle === 'archive' ? '보관' : '복원', lifecycle]]} /> : local.phase === 'confirm-close' ? <DialogChoice titleId={phaseTitleId} cancelRef={choiceCancel} title="변경 사항 폐기" text="저장하지 않은 변경 사항을 폐기하고 닫을까요?" onCancel={() => setLocal({ ...local, phase: 'edit' })} actions={[['폐기하고 닫기', close]]} /> : local.phase === 'edit' && local.draft ? <EditView titleId={phaseTitleId} book={local.draft} categories={categories} setDraft={setDraft} save={save} discard={() => local.identity.kind === 'create' ? close() : setLocal({ ...local, phase: 'read', baseline: undefined, draft: undefined })} canManageLifecycle={local.identity.kind === 'persisted'} requestLifecycle={() => requestLifecycle(archived ? 'restore' : 'archive')} lifecycleLabel={archived ? '복원' : '보관'} /> : <><ReadView book={book} titleId={titleId} />{local.audience === 'management' && <div className="dialog-actions"><button onClick={startEdit}>편집</button><button ref={inverse} onClick={() => requestLifecycle(archived ? 'restore' : 'archive')}>{archived ? '복원' : '보관'}</button></div>}</>}</div></motion.div></motion.div>;
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
function ReadView({ book, titleId }: { book: Book; titleId: string }) {
  const credits = [
    ['글', book.author],
    ['그림', book.illustrator],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
  const publication = [
    ['출판사', book.publisher],
    ['발행일', book.publishedAt],
    ['정가', book.listPrice ? `${book.listPrice.toLocaleString('ko-KR')}원` : undefined],
    ['ISBN', book.isbn],
    ['사양', book.specs],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
  const categories = book.categories.filter((item) => item !== '보관').join(' · ') || '분류 없음';
  const provenance = book.introSource === 'YES24_PARAPHRASE' ? 'Yes24 기반으로 운영자가 재구성한 소개 문구입니다.' : book.introSource === 'ADMIN' ? '운영자가 등록한 큐레이션 소개 문구입니다.' : '소개 출처가 확인되지 않았습니다.';
  const introParagraphs = book.intro ? splitIntoParagraphs(book.intro) : [];
  const introSection = book.intro && <section className="intro-section"><h3>책 소개와 줄거리</h3><div className="intro-copy">{introParagraphs.map((paragraph, index) => <p key={`${book.id}-intro-${index}`}>{paragraph}</p>)}</div><small className="detail-provenance">{provenance}</small></section>;
  return <article className="book-detail">
    <div className="detail-spread">
      <div className="detail-hero">
        <img className="detail-cover" src={book.cover} alt={`${book.title} 표지`} />
      </div>
      <header className="detail-heading">
        <p className="detail-kicker">{categories}</p>
        <FittedDetailTitle id={titleId} title={book.title} />
        {book.english && <p className="detail-english">{book.english}</p>}
      </header>
      <div className="detail-reading">
        {credits.length > 0 && <section className="detail-fact-group detail-credits"><h3>작가</h3><dl>{credits.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
        {introSection}
      </div>
    </div>
    {publication.length > 0 && <section className="detail-fact-group detail-publication detail-publication-section"><h3>책 정보</h3><dl>{publication.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    {(book.keywords || (book.awards && book.awards !== '없음') || book.yes24Url) && <div className="detail-support">
      {book.keywords && <section><h3>키워드</h3><p>{book.keywords}</p></section>}
      {book.awards && book.awards !== '없음' && <section><h3>수상 및 추천</h3><p>{book.awards}</p></section>}
      {book.yes24Url && <section className="source-section"><a href={book.yes24Url} target="_blank" rel="noreferrer">예스24에서 상세 정보 보기 ↗</a></section>}
    </div>}
  </article>;
}
function EditView({ titleId, book, categories, setDraft, save, discard, canManageLifecycle, requestLifecycle, lifecycleLabel }: { titleId: string; book: Book; categories: string[]; setDraft: (field: keyof Book, value: string | string[]) => void; save: () => void; discard: () => void; canManageLifecycle: boolean; requestLifecycle: () => void; lifecycleLabel: string }) { const fields: (keyof Book)[] = ['title', 'english', 'author', 'illustrator', 'cover', 'intro', 'awards', 'isbn', 'specs', 'keywords']; return <form className="editor" onSubmit={(event) => { event.preventDefault(); save(); }}><h2 id={titleId}>책 편집</h2>{fields.map((field) => <label key={field}>{field}<textarea value={typeof book[field] === 'string' ? book[field] as string : ''} onChange={(event) => setDraft(field, event.target.value)} /></label>)}<fieldset><legend>카테고리</legend>{categories.filter((item) => item !== '보관').map((category) => <label key={category}><input type="checkbox" checked={book.categories.includes(category)} onChange={() => setDraft('categories', book.categories.includes(category) ? book.categories.filter((item) => item !== category) : [...book.categories, category])} />{category}</label>)}</fieldset><button>저장</button><button type="button" onClick={discard}>변경 취소</button>{canManageLifecycle && <button type="button" onClick={requestLifecycle}>{lifecycleLabel}</button>}</form>; }
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
