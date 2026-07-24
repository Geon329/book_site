import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const importedCatalog = {
  schemaVersion: 1,
  catalogVersion: 4,
  categories: ['가져오기 테스트', '보관'],
  books: [{
    id: 'catalog-imported-book',
    title: '가져온 테스트 책',
    english: 'Imported Test Book',
    author: '테스트 작가',
    illustrator: '테스트 일러스트레이터',
    publisher: '테스트 출판사',
    categories: ['가져오기 테스트'],
    cover: 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
  }],
};

const catalogFile = (name: string, catalog: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(catalog)),
});

async function openManagement(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '관리자 데모' }).click();
  await expect(page.getByRole('heading', { name: '서가 관리' })).toBeVisible();
}

test.describe('book shelf motion', () => {
  test('keeps the shelf stable while filtered cards reflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'The ChoiceMaker Korea — Featured Books' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'The ChoiceMaker Korea' })).toBeVisible();
    await expect(page.locator('.shelf-footer')).toHaveText('The ChoiceMaker Korea · Featured Books');
    await expect(page.locator('.book-card')).toHaveCount(13);
    await expect(page.getByRole('button', { name: 'Fiction', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Picture Books', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Educational Comics', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Graphic Novels', exact: true })).toBeVisible();
    await expect(page.locator('.book-card').first().locator('strong')).toHaveText('Hunter Girl 1: The Mirror Goddess');

    const before = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      gutter: getComputedStyle(document.documentElement).scrollbarGutter,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    await page.getByRole('button', { name: 'Graphic Novels', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Graphic Novels', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(320);

    const filtered = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(before.gutter).toBe('stable both-edges');
    expect(filtered.clientWidth).toBe(before.clientWidth);
    expect(filtered.scrollWidth).toBeLessThanOrEqual(filtered.clientWidth);

    await page.getByRole('button', { name: 'Graphic Novels', exact: true }).click();
    await page.waitForTimeout(320);
    const restored = await page.evaluate(() => document.documentElement.clientWidth);
    expect(restored).toBe(before.clientWidth);
  });
  test('flows card titles naturally without disturbing grid rows', async ({ page }) => {
    await page.goto('/');
    const layout = await page.locator('.book-card').evaluateAll((cards) => cards.slice(0, 8).map((card) => {
      const cover = card.querySelector<HTMLElement>('.cover-frame')!;
      const title = card.querySelector<HTMLElement>('strong')!;
      const creator = card.querySelector<HTMLElement>('.book-creators')!;
      return {
        coverTop: Math.round(cover.getBoundingClientRect().top),
        creatorTop: Math.round(creator.getBoundingClientRect().top),
        titleMinBlockSize: getComputedStyle(title).minBlockSize,
      };
    }));

    expect(new Set(layout.slice(0, 4).map((card) => card.coverTop)).size).toBe(1);
    expect(new Set(layout.slice(4).map((card) => card.coverTop)).size).toBe(1);
    expect(layout[4].coverTop).toBeGreaterThan(layout[0].coverTop);
    expect(layout[1].creatorTop).toBeLessThan(layout[0].creatorTop);
    expect(layout[0].titleMinBlockSize).toBe('auto');
  });
  test('fades in loaded covers without changing their geometry', async ({ page }) => {
    await page.goto('/');
    const cover = page.locator('.book-cover').first();
    await expect(cover).toBeVisible();
    await expect.poll(() => cover.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    const box = await cover.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });
  test('sweeps a diagonal cover sheen beyond the full cover', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.book-card').first();
    const cover = card.locator('.book-cover');
    const coverFrame = card.locator('.cover-frame');
    await expect(cover).toBeVisible();

    const before = await cover.boundingBox();
    await card.hover();
    await expect.poll(() => coverFrame.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('1');
    await expect.poll(() => cover.evaluate((element) => getComputedStyle(element).filter)).toContain('brightness');
    await page.waitForTimeout(980);
    const sheenExit = await coverFrame.evaluate((element) => ({
      offset: new DOMMatrixReadOnly(getComputedStyle(element, '::after').transform).m41,
      width: element.getBoundingClientRect().width,
    }));
    expect(sheenExit.offset).toBeGreaterThan(sheenExit.width);

    const after = await cover.boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  });

  test('transitions to the empty state when a new category has no books', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '관리자 데모' }).click();
    await page.getByLabel('새 카테고리').fill('빈 Motion');
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await page.getByRole('button', { name: '빈 Motion', exact: true }).click();

    const empty = page.locator('.empty');
    await expect(empty).toHaveText('이 카테고리에 공개된 책이 없습니다');
    await expect.poll(() => empty.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  });
  test('keeps the editorial detail layout compact on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('.book-card').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect.poll(() => dialog.locator('.detail-title').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const layout = await dialog.evaluate((element) => {
      const credits = element.querySelector('.detail-credits dl');
      const publication = element.querySelector('.detail-publication dl');
      const isbn = element.querySelector('.detail-meta-isbn dd');
      const title = element.querySelector<HTMLElement>('.detail-title');
      const cover = element.querySelector<HTMLElement>('.detail-cover');
      const intro = element.querySelector<HTMLElement>('.intro-section');
      const publicationSection = element.querySelector<HTMLElement>('.detail-publication-section');
      const range = document.createRange();
      if (isbn) range.selectNodeContents(isbn);
      return {
        overflowX: element.scrollWidth > element.clientWidth,
        creditCount: credits?.querySelectorAll('div').length ?? 0,
        publicationColumns: publication ? getComputedStyle(publication).gridTemplateColumns.split(' ').length : 0,
        publicationCount: publication?.querySelectorAll('div').length ?? 0,
        isbnHeight: Math.round(range.getBoundingClientRect().height),
        titleFits: Boolean(title && title.scrollWidth <= title.clientWidth),
        titleWhiteSpace: title ? getComputedStyle(title).whiteSpace : '',
        titleBeforeCover: Boolean(cover && title && title.getBoundingClientRect().top < cover.getBoundingClientRect().top),
        hasSectionDividers: [intro, publicationSection].every((section) => Boolean(section) && getComputedStyle(section).borderTopWidth !== '0px'),
        introBeforePublication: Boolean(intro && publicationSection && intro.getBoundingClientRect().top < publicationSection.getBoundingClientRect().top),
      };
    });

    await expect(dialog.getByRole('heading', { name: '작가' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '책 정보' })).toBeVisible();
    expect(layout.overflowX).toBe(false);
    expect(layout.creditCount).toBe(2);
    expect(layout.publicationColumns).toBe(2);
    expect(layout.publicationCount).toBe(5);
    expect(layout.isbnHeight).toBeLessThanOrEqual(16);
    expect(layout.titleFits).toBe(true);
    expect(layout.titleWhiteSpace).toBe('nowrap');
    expect(layout.titleBeforeCover).toBe(true);
    expect(layout.hasSectionDividers).toBe(true);
    expect(layout.introBeforePublication).toBe(true);
  });
  test('keeps the cover prominent and centered through tablet widths', async ({ page }) => {
    await page.setViewportSize({ width: 481, height: 844 });
    await page.goto('/');
    await page.locator('.book-card').first().click();
    const cover = page.locator('.detail-cover');
    await expect(cover).toBeVisible();

    const layout = await page.evaluate(() => {
      const cover = document.querySelector<HTMLElement>('.detail-cover')!;
      const hero = document.querySelector<HTMLElement>('.detail-hero')!;
      const coverRect = cover.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      return {
        width: Math.round(coverRect.width),
        centered: Math.abs((coverRect.left + coverRect.width / 2) - (heroRect.left + heroRect.width / 2)) <= 1,
      };
    });

    expect(layout.width).toBeGreaterThanOrEqual(200);
    expect(layout.centered).toBe(true);
  });
  test('keeps a long title to one line across responsive widths', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 844 });
    await page.goto('/');
    await page.locator('.book-card').first().click();
    const title = page.locator('.detail-title');
    await expect(title).toBeVisible();

    for (const width of [800, 631, 596, 481, 439, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  });


  test('keeps motion off when reduced motion is requested', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const card = page.locator('.book-card').first();
    await card.hover();
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element).transform)).toBe('none');

    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    await context.close();
  });

  test('preserves detail dialog focus behavior', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('.book-card').first();
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: '상세 닫기' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(opener).toBeFocused();
  });
  test('adds new JSON catalog books and persists them locally', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const initialBookCount = await page.getByRole('region', { name: '책 목록' }).getByRole('button').count();

    await page.getByRole('button', { name: 'Graphic Novels', exact: true }).click();
    await openManagement(page);

    const importFile = page.getByLabel(/카탈로그 JSON/);
    await expect(importFile).toHaveAttribute('accept', /application\/json|\.json/);
    await expect(page.getByRole('button', { name: '카탈로그 JSON 가져오기', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '카탈로그 JSON 내보내기', exact: true })).toBeVisible();

    await importFile.setInputFiles(catalogFile('valid-catalog.json', importedCatalog));
    await expect(page.getByRole('status')).toHaveText(/1권을 카탈로그에 추가했습니다/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '카탈로그 JSON 내보내기', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('book-catalog.json');
    const exportPath = await download.path();
    expect(exportPath).not.toBeNull();
    const exportedCatalog = JSON.parse(await readFile(exportPath!, 'utf8'));
    expect(exportedCatalog).toMatchObject({ schemaVersion: 1, catalogVersion: 4 });
    expect(exportedCatalog.books).toHaveLength(initialBookCount + 1);
    expect(exportedCatalog.books).toContainEqual(importedCatalog.books[0]);
    await expect.poll(() => page.evaluate(() => Object.values(localStorage).some((value) => {
      try {
        return JSON.parse(value).books?.some((book: { id?: unknown }) => book.id === 'catalog-imported-book') === true;
      } catch {
        return false;
      }
    }))).toBe(true);
    await importFile.setInputFiles(catalogFile('existing-id.json', importedCatalog));
    await expect(page.getByRole('status')).toHaveText(/카탈로그 JSON을 가져오지 못했습니다: 이미 등록된 책 ID입니다/);
    await page.getByRole('button', { name: '공개 서가 보기' }).click();

    const publicCatalog = page.getByRole('region', { name: '책 목록' });
    await expect(publicCatalog.getByRole('button')).toHaveCount(initialBookCount + 1);
    await expect(publicCatalog.getByRole('button', { name: /Imported Test Book/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '가져오기 테스트', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '보관', exact: true })).toHaveCount(0);

    await page.reload();
    await expect(publicCatalog.getByRole('button')).toHaveCount(initialBookCount + 1);
    await expect(publicCatalog.getByRole('button', { name: /Imported Test Book/ })).toBeVisible();
  });

  test('keeps the existing catalog when JSON imports are invalid', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const publicCatalog = page.getByRole('region', { name: '책 목록' });
    const previousCardCount = await publicCatalog.getByRole('button').count();
    const previousTitle = await publicCatalog.getByRole('button').first().textContent();
    await openManagement(page);

    const importFile = page.getByLabel(/카탈로그 JSON/);
    const invalidCatalogs = [
      { name: 'wrong-schema.json', catalog: { ...importedCatalog, schemaVersion: 2 } },
      { name: 'duplicate-id.json', catalog: { ...importedCatalog, books: [...importedCatalog.books, { ...importedCatalog.books[0] }] } },
      { name: 'blank-id.json', catalog: { ...importedCatalog, books: [{ ...importedCatalog.books[0], id: ' ' }] } },
    ];

    for (const { name, catalog } of invalidCatalogs) {
      await importFile.setInputFiles(catalogFile(name, catalog));
      await expect(page.getByRole('status')).toHaveText(/카탈로그 JSON을 가져오지 못했습니다/);
    }

    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(publicCatalog.getByRole('button')).toHaveCount(previousCardCount);
    await expect(publicCatalog.getByRole('button').first()).toHaveText(previousTitle ?? '');
  });
  test('restores the bundled JSON catalog when a stored draft has a stale source fingerprint', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((catalog) => {
      localStorage.setItem('book-margin-demo-v2', JSON.stringify({
        catalogVersion: 4,
        sourceFingerprint: 'stale-source',
        categories: catalog.categories,
        books: catalog.books,
      }));
    }, importedCatalog);
    await page.reload();

    const publicCatalog = page.getByRole('region', { name: '책 목록' });
    await expect(publicCatalog.getByRole('button')).toHaveCount(13);
    await expect(publicCatalog.getByRole('button', { name: /Imported Test Book/ })).toHaveCount(0);
  });
});
