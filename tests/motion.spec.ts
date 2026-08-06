import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const importedCatalog = {
  schemaVersion: 1,
  catalogVersion: 6,
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
    awards: [],
    rightsSold: [],
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
  test('links the full fair title back to the main page', async ({ page }) => {
    await page.goto('/#featured-titles');

    const mainPageLink = page.getByRole('link', { name: 'Main Page' });
    await expect(mainPageLink).toHaveAttribute('href', '/');
    await expect(mainPageLink.getByRole('heading', { name: 'The ChoiceMaker Korea Selection for 2026 Frankfurt Book Fair' })).toBeVisible();
    await mainPageLink.click();

    await expect(page).toHaveURL(/\/$/);
  });
  test('merges educational comics and graphic novels into one category', async ({ page }) => {
    await page.goto('/');

    const categories = page.locator('.public-category-navigation .filters button');
    await expect(categories).toHaveText(['Picture Books', 'Fictions', 'Comics & Graphic Novels', 'Language Learning']);
    await page.getByRole('button', { name: 'Comics & Graphic Novels', exact: true }).click();

    await expect(page.locator('.book-card')).toHaveCount(3);
    expect(await page.locator('.book-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-book-id')))).toEqual(['cosmoswek-1', 'science-explorers-17', 'tomorrow-too']);
  });
  test('renders the desktop shelf at an 80 percent page scale', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const desktopScale = await page.locator('.public-shelf').evaluate((shelf) => ({
      zoom: getComputedStyle(shelf).zoom,
      layoutWidth: shelf.clientWidth,
      visualWidth: shelf.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(desktopScale.zoom).toBe('0.8');
    expect(desktopScale.layoutWidth).toBeGreaterThan(desktopScale.viewportWidth);
    expect(desktopScale.visualWidth / desktopScale.layoutWidth).toBeCloseTo(.8, 2);
    expect(desktopScale.documentWidth).toBeLessThanOrEqual(desktopScale.viewportWidth);

    await page.setViewportSize({ width: 640, height: 900 });
    await expect.poll(() => page.locator('.public-shelf').evaluate((shelf) => getComputedStyle(shelf).zoom)).toBe('1');
  });
  test('renders the public editorial shelf with its two-band header and English category filtering', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page).toHaveTitle('도서전 소개');
    await expect(page.locator('.public-header-primary')).toBeVisible();
    await expect(page.locator('.public-category-navigation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The ChoiceMaker Korea Selection for 2026 Frankfurt Book Fair', level: 1 })).toBeVisible();
    await expect(page.getByRole('img', { name: 'The ChoiceMaker Korea', exact: true })).toBeVisible();
    await expect(page.locator('.public-header-brand')).toHaveText('The ChoiceMaker Korea Selection for 2026 Frankfurt Book Fair');
    const headerBands = await page.locator('.public-header').evaluate((header) => {
      const primary = header.querySelector<HTMLElement>('.public-header-primary')!.getBoundingClientRect();
      const navigation = header.querySelector<HTMLElement>('.public-category-navigation')!;
      const filters = Array.from(header.querySelectorAll<HTMLElement>('.filters button'));
      return {
        primaryBeforeNavigation: primary.bottom <= navigation.getBoundingClientRect().top,
        brandHeight: Math.round(primary.height),
        logoWidth: Math.round(header.querySelector<HTMLElement>('.public-header-logo')!.getBoundingClientRect().width),
        navigationRule: getComputedStyle(navigation).borderBottom,
        navigationTopRule: getComputedStyle(navigation).borderTop,
        categoryWidths: filters.map((button) => Math.round(button.getBoundingClientRect().width)),
        separators: filters.slice(1).map((button) => getComputedStyle(button, '::before').height),
      };
    });
    expect(headerBands.primaryBeforeNavigation).toBe(true);
    expect(headerBands.brandHeight).toBe(80);
    expect(headerBands.logoWidth).toBe(72);
    expect(headerBands.navigationRule).toBe('2px solid rgb(55, 81, 95)');
    expect(headerBands.navigationTopRule).toBe('1px solid rgb(216, 211, 204)');
    expect(Math.max(...headerBands.categoryWidths) - Math.min(...headerBands.categoryWidths)).toBeLessThanOrEqual(1);
    expect(headerBands.separators).toEqual(['16px', '16px', '16px']);

    const categories = page.locator('.public-category-navigation .filters button');
    await expect(categories).toHaveText(['Picture Books', 'Fictions', 'Comics & Graphic Novels', 'Language Learning']);
    await expect(categories).toHaveCount(4);

    const initialCount = await page.locator('.book-card').count();
    const graphicNovels = page.getByRole('button', { name: 'Comics & Graphic Novels', exact: true });
    await graphicNovels.click();
    await expect(graphicNovels).toHaveAttribute('aria-pressed', 'true');
    await expect(graphicNovels).toHaveCSS('background-color', 'rgb(55, 81, 95)');
    await expect(graphicNovels).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(graphicNovels).toHaveCSS('background-image', 'none');
    await expect(page.locator('.public-hero')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Featured Titles', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Comics & Graphic Novels', level: 2, exact: true })).toBeVisible();
    await expect(page.locator('.public-featured-divider')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /View all titles/ })).toHaveCount(0);
    await expect.poll(() => page.locator('.book-card').count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('.book-card').count()).toBeLessThan(initialCount);
    expect(await page.locator('.grid').evaluate((grid) => grid.getAnimations().length)).toBe(0);
    const filteredViewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(filteredViewport.scrollWidth).toBeLessThanOrEqual(filteredViewport.clientWidth);

    const pictureBooks = page.getByRole('button', { name: 'Picture Books', exact: true });
    await pictureBooks.click();
    await expect(graphicNovels).toHaveAttribute('aria-pressed', 'false');
    await expect(pictureBooks).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.public-category-navigation [aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Comics & Graphic Novels', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Picture Books', level: 2, exact: true })).toBeVisible();

    await pictureBooks.click();
    await expect(pictureBooks).toHaveAttribute('aria-pressed', 'false');
    await expect(pictureBooks).toHaveCSS('background-image', 'none');
    await expect(page.locator('.book-card')).toHaveCount(initialCount, { timeout: 10_000 });
    await expect(page.locator('.public-hero')).toBeVisible();
    await expect(page.locator('#public-hero-heading')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('heading', { name: 'Featured Titles', level: 2, exact: true })).toBeVisible();
    await expect(page.locator('.public-featured-divider')).toBeVisible();
    await expect(page.getByRole('link', { name: /View all titles/ })).toBeVisible();
  });

  test('shows the reusable audience filter for Fiction at every viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1672, height: 900 });
    await page.goto('/');
    await expect(page.locator('.audience-filter')).toHaveCount(0);

    await page.getByRole('button', { name: 'Fictions', exact: true }).click();
    const filter = page.getByRole('group', { name: 'Fiction 독자 연령 필터' });
    await expect(filter).toBeVisible();

    const options = filter.getByRole('button');
    await expect(options).toHaveText(['All', 'Early Readers', 'Middle Grade', 'Young Adult']);
    const all = filter.getByRole('button', { name: 'All', exact: true });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveCSS('border-bottom-color', 'rgb(55, 81, 95)');
    await expect(all).toHaveCSS('color', 'rgb(55, 81, 95)');
    await expect(filter.locator('svg.rough-annotation')).toHaveCount(0);
    await expect(page.locator('.book-card')).toHaveCount(5, { timeout: 10_000 });

    const middleGrade = filter.getByRole('button', { name: 'Middle Grade', exact: true });
    await middleGrade.click();
    await expect(middleGrade).toHaveAttribute('aria-pressed', 'true');
    await expect(middleGrade).toHaveCSS('border-bottom-color', 'rgb(55, 81, 95)');
    await expect(page.locator('.book-card')).toHaveCount(2, { timeout: 10_000 });
    expect(await page.locator('.book-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-book-id')))).toEqual(['huntergirl-1', 'on-the-ball-1']);

    await filter.getByRole('button', { name: 'Young Adult', exact: true }).click();
    await expect(page.locator('.book-card')).toHaveCount(3, { timeout: 10_000 });
    expect(await page.locator('.book-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-book-id')))).toEqual(['sticker', 'shaker', 'baedalhee']);

    await filter.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('.book-card')).toHaveCount(5, { timeout: 10_000 });
    const desktopLayout = await page.evaluate(() => {
      const heading = document.querySelector<HTMLElement>('.public-featured-heading')!;
      const title = heading.querySelector<HTMLElement>('h2')!;
      const filterElement = heading.querySelector<HTMLElement>('.audience-filter')!;
      const firstCards = Array.from(document.querySelectorAll<HTMLElement>('.book-card')).slice(0, 5);
      return {
        filterPosition: getComputedStyle(filterElement).position,
        titleCenter: Math.round(title.getBoundingClientRect().top + title.getBoundingClientRect().height / 2),
        filterCenter: Math.round(filterElement.getBoundingClientRect().top + filterElement.getBoundingClientRect().height / 2),
        cardTops: firstCards.map((card) => Math.round(card.getBoundingClientRect().top)),
        cardWidths: firstCards.map((card) => Math.round(card.getBoundingClientRect().width)),
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(desktopLayout.filterPosition).toBe('static');
    expect(Math.abs(desktopLayout.titleCenter - desktopLayout.filterCenter)).toBeLessThanOrEqual(1);
    expect(new Set(desktopLayout.cardTops).size).toBe(1);
    expect(new Set(desktopLayout.cardWidths)).toEqual(new Set([270]));
    expect(desktopLayout.hasHorizontalOverflow).toBe(false);

    await page.getByRole('button', { name: 'Picture Books', exact: true }).click();
    await expect(page.locator('.audience-filter')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Fictions', exact: true }).click();
    const mobileFilter = page.getByRole('group', { name: 'Fiction 독자 연령 필터' });
    await expect(mobileFilter).toBeVisible();
    await mobileFilter.getByRole('button', { name: 'Middle Grade', exact: true }).click();
    await expect(page.locator('.book-card')).toHaveCount(2, { timeout: 10_000 });
    expect(await mobileFilter.evaluate((element) => element.scrollWidth >= element.clientWidth)).toBe(true);
  });

  test('switches the shelf instantly when crossing the Fiction filter boundary', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Fictions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fictions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.book-card')).toHaveCount(5);
    expect(await page.locator('.grid').evaluate((grid) => grid.getAnimations().length)).toBe(0);
    const fictionGeometry = await page.evaluate(() => ({
      headingTop: Math.round(document.querySelector<HTMLElement>('.public-featured-heading')!.getBoundingClientRect().top),
      cardTop: Math.round(document.querySelector<HTMLElement>('.book-card')!.getBoundingClientRect().top),
    }));

    await page.getByRole('button', { name: 'Picture Books', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Picture Books', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.book-card')).toHaveCount(5);
    expect(await page.locator('.grid').evaluate((grid) => grid.getAnimations().length)).toBe(0);
    const pictureBookGeometry = await page.evaluate(() => ({
      headingTop: Math.round(document.querySelector<HTMLElement>('.public-featured-heading')!.getBoundingClientRect().top),
      cardTop: Math.round(document.querySelector<HTMLElement>('.book-card')!.getBoundingClientRect().top),
    }));
    expect(fictionGeometry).toEqual(pictureBookGeometry);
  });

  test('uses public English category labels in management', async ({ page }) => {
    await page.goto('/');
    await openManagement(page);

    const categoryManagement = page.locator('.management-section').filter({ has: page.getByRole('heading', { name: '카테고리 관리' }) });
    await expect(categoryManagement.locator('.manage-list > li > span')).toHaveText(['Picture Books', 'Fictions', 'Comics & Graphic Novels', 'Language Learning', 'Archived (예약됨)']);

    await categoryManagement.getByRole('button', { name: '이름 변경' }).first().click();
    await expect(categoryManagement.getByLabel('Picture Books 새 이름')).toHaveValue('Picture Books');
  });

  test('ships sourced audience guidance for every catalog book and displays it in details', async ({ page }) => {
    const catalog = JSON.parse(await readFile('src/books.json', 'utf8')) as {
      books: Array<{
        id: string;
        recommendedAudience?: {
          label: string;
          band?: string;
          ageRange?: { min: number; max: number };
          schoolRange?: { from: string; to: string };
          evidenceLabel?: string;
          sourceType: string;
          sourceUrl?: string;
          confidence: string;
        };
      }>;
    };
    const guidance = catalog.books.map((book) => ({ id: book.id, ...book.recommendedAudience }));
    expect(guidance).toHaveLength(16);
    expect(guidance.every((item) => Boolean(item.label && item.sourceType && item.confidence && (item.sourceType === 'unavailable' || item.band)))).toBe(true);
    expect(guidance.filter((item) => item.sourceType !== 'unavailable')).toHaveLength(13);
    expect(guidance.filter((item) => item.sourceType === 'unavailable')).toHaveLength(3);
    expect(guidance.filter((item) => item.band === 'early-readers')).toHaveLength(6);
    expect(guidance.filter((item) => item.band === 'middle-grade')).toHaveLength(4);
    expect(guidance.filter((item) => item.band === 'young-adult')).toHaveLength(3);
    expect(guidance.find((item) => item.id === 'huntergirl-1')).toMatchObject({
      label: 'Middle Grade · 초등 3~6학년 (만 9~12세)',
      band: 'middle-grade',
      ageRange: { min: 9, max: 12 },
      schoolRange: { from: 'elementary-3', to: 'elementary-6' },
      evidenceLabel: '초등 3~6학년',
      sourceType: 'yes24-category',
    });
    expect(guidance.find((item) => item.id === 'shaker')).toMatchObject({
      label: 'Young Adult · 청소년 (만 13~18세)',
      band: 'young-adult',
      ageRange: { min: 13, max: 18 },
      schoolRange: { from: 'middle-1', to: 'high-3' },
      evidenceLabel: '중3~고등학생',
      sourceType: 'curated-recommendation',
      confidence: 'high',
    });

    await page.goto('/');
    await page.locator('.book-card[data-book-id="huntergirl-1"]').click();
    const audienceFact = page.getByRole('dialog').locator('.detail-publication div').filter({ hasText: '추천 독자' });
    await expect(audienceFact).toContainText('Middle Grade · 초등 3~6학년 (만 9~12세)');
  });

  test('reveals award and rights metadata over covers and moves it into book details', async ({ page }) => {
    const catalog = JSON.parse(await readFile('src/books.json', 'utf8')) as {
      books: Array<{ id: string; awards?: unknown; rightsSold?: unknown }>;
    };
    expect(catalog.books.every((book) => Array.isArray(book.awards) && Array.isArray(book.rightsSold))).toBe(true);
    expect(catalog.books.filter((book) => !book.id.startsWith('language-learning-swipe-test')).every((book) => (book.rightsSold as unknown[]).length === 0)).toBe(true);
    expect(catalog.books.filter((book) => book.id.startsWith('language-learning-swipe-test')).every((book) => (book.awards as unknown[]).length > 0 && (book.rightsSold as unknown[]).length > 0)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const emptyCard = page.locator('.book-card[data-book-id="sticker"]');
    const emptyOverlay = emptyCard.locator('.book-card-overlay');
    await expect(emptyOverlay).toHaveCSS('opacity', '0');
    await expect(emptyOverlay).toHaveCSS('visibility', 'hidden');
    await expect(emptyOverlay.locator('.book-overlay-empty-icon')).toHaveCount(1);
    await expect(emptyOverlay.locator('.book-overlay-award-icon, .book-overlay-section, .book-overlay-rights')).toHaveCount(0);
    await emptyCard.hover();
    await expect(emptyOverlay).toHaveCSS('opacity', '1');
    await expect(emptyOverlay).toHaveCSS('visibility', 'visible');

    const awardedCard = page.locator('.book-card[data-book-id="huntergirl-1"]');
    await awardedCard.hover();
    await expect(awardedCard.locator('.book-overlay-award-icon')).toHaveCount(1);
    await expect(awardedCard.locator('.book-overlay-section')).toContainText('한겨레 미디어 추천');
    await expect(awardedCard.locator('.book-overlay-rights')).toHaveCount(0);

    const rightsCard = page.locator('.book-card[data-book-id="star-cat-village-4"]');
    const rightsShell = page.locator('.book-card-shell').filter({ has: rightsCard });
    await rightsCard.hover();
    const rightsStacking = await rightsShell.evaluate((shell) => {
      const note = shell.querySelector<HTMLElement>('.book-sticky-note')!;
      const overlay = shell.querySelector<HTMLElement>('.book-card-overlay')!;
      const noteRect = note.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      return {
        noteLayer: Number.parseInt(getComputedStyle(note).zIndex, 10),
        overlayLayer: Number.parseInt(getComputedStyle(overlay).zIndex, 10),
        overlaps: noteRect.left < overlayRect.right && noteRect.right > overlayRect.left && noteRect.top < overlayRect.bottom && noteRect.bottom > overlayRect.top,
      };
    });
    expect(rightsStacking.overlaps).toBe(true);
    expect(rightsStacking.overlayLayer).toBeGreaterThan(rightsStacking.noteLayer);

    await page.getByRole('button', { name: 'Language Learning', exact: true }).click();
    const metadataCard = page.locator('.book-card[data-book-id="language-learning-swipe-test-1"]');
    await expect(metadataCard).toBeVisible();
    const metadataOverlay = metadataCard.locator('.book-card-overlay');
    await metadataCard.hover();
    await expect(metadataOverlay.locator('.book-overlay-award-icon')).toHaveCount(3);
    await expect(metadataOverlay.locator('.book-overlay-rights')).toContainText('Rights Sold');
    await expect(metadataOverlay.locator('.book-overlay-rights')).toContainText('Korean');
    await expect(metadataOverlay.locator('.book-overlay-rights')).toContainText('Complex Chinese');
    const overlayGeometry = await metadataCard.evaluate((card) => {
      const cover = card.querySelector<HTMLElement>('.cover-frame')!.getBoundingClientRect();
      const overlay = card.querySelector<HTMLElement>('.book-card-overlay')!.getBoundingClientRect();
      return {
        sameBounds: Math.round(cover.width) === Math.round(overlay.width) && Math.round(cover.height) === Math.round(overlay.height),
        transition: getComputedStyle(card.querySelector<HTMLElement>('.book-card-overlay')!).transition,
      };
    });
    expect(overlayGeometry.sameBounds).toBe(true);
    expect(overlayGeometry.transition).toContain('opacity 0.3s');

    await page.mouse.move(0, 0);
    await metadataCard.focus();
    await expect(metadataOverlay).toHaveCSS('opacity', '0');
    await expect(metadataOverlay).toHaveCSS('visibility', 'hidden');
    await metadataCard.click();

    const dialog = page.getByRole('dialog');
    const keywordFact = dialog.locator('.detail-publication div').filter({ hasText: '키워드' });
    await expect(keywordFact).toContainText('언어 학습, 낱말 탐색, 종이비행기, 테스트 시리즈');
    await expect(dialog.getByRole('heading', { name: '키워드', exact: true })).toHaveCount(0);
    const rightsSection = dialog.locator('.rights-sold-section');
    await expect(rightsSection.getByRole('heading', { name: 'Rights Sold', exact: true })).toBeVisible();
    await expect(rightsSection.locator('li')).toHaveText(['Korean', 'Japanese', 'Complex Chinese', 'English']);
    await expect(dialog.getByRole('heading', { name: '수상 및 추천', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await expect(metadataCard).toBeFocused();
    await expect(metadataOverlay).toHaveCSS('opacity', '0');
    await expect(metadataOverlay).toHaveCSS('visibility', 'hidden');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Language Learning', exact: true }).click();
    await expect(page.locator('.book-card-overlay').first()).toHaveCSS('display', 'none');
  });

  test('uses the local editorial hero image, copy, CTA, and typography tokens', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.setViewportSize({ width: 1672, height: 941 });
    await page.goto('/');

    const hero = page.locator('.public-hero');
    const heroImage = hero.locator('.public-hero-image');
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('heading', { name: 'Curated Stories. Worldwide Impact.' })).toBeVisible();
    const subtitle = hero.locator('.public-hero-subtitle');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toContainText('The ChoiceMaker Korea');
    await expect(subtitle).toContainText('2026 Frankfurt BookFair Exhibit Titles');
    await expect(hero.locator('.public-hero-eyebrow')).toHaveCount(0);
    await expect(hero.getByRole('heading')).toContainText('Curated Stories.');
    await expect(hero.getByRole('heading')).toContainText('Worldwide Impact.');
    await expect(heroImage).toHaveAttribute('alt', 'The ChoiceMaker Korea의 어린이 책 컬렉션');
    await expect(heroImage).toHaveAttribute('src', /\.png(?:$|\?)/);

    const cta = hero.locator('.public-hero-cta');
    await expect(cta).toHaveText('Explore Our Portfolio →');
    await expect(cta).toHaveAttribute('href', '#featured-titles');
    await cta.click();
    await expect(page.locator('#featured-titles.public-featured')).toBeInViewport();

    const typography = await page.evaluate(() => {
      const shelf = document.querySelector<HTMLElement>('.public-shelf')!;
      const heading = document.querySelector<HTMLElement>('.public-hero h2')!;
      const subtitle = document.querySelector<HTMLElement>('.public-hero-subtitle')!;
      const image = document.querySelector<HTMLElement>('.public-hero-image')!;
      const navigation = document.querySelector<HTMLElement>('.public-category-navigation')!;
      const featuredHeading = document.querySelector<HTMLElement>('.public-featured-heading')!;
      const featuredDivider = document.querySelector<HTMLElement>('.public-featured-divider')!;
      const hero = heading.closest<HTMLElement>('.public-hero')!;
      const filters = document.querySelector<HTMLElement>('.public-category-navigation .filters')!;
      const featuredLink = featuredHeading.querySelector<HTMLElement>('a')!;
      const firstCard = document.querySelector<HTMLElement>('.book-card')!;
      return {
        shelfBackground: getComputedStyle(shelf).backgroundColor,
        headingColor: getComputedStyle(heading).color,
        headingFont: getComputedStyle(heading).fontFamily,
        headingFontSize: getComputedStyle(heading).fontSize,
        headingBreaks: heading.querySelectorAll('br').length,
        subtitleColor: getComputedStyle(subtitle).color,
        subtitleFont: getComputedStyle(subtitle).fontFamily,
        subtitleFontSize: getComputedStyle(subtitle).fontSize,
        subtitleFontWeight: getComputedStyle(subtitle).fontWeight,
        subtitleLineHeight: getComputedStyle(subtitle).lineHeight,
        categoryToHeadingGap: Math.round(heading.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom),
        headingToSubtitleGap: Math.round(subtitle.getBoundingClientRect().top - heading.getBoundingClientRect().bottom),
        categoryToImageGap: Math.round(image.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom),
        illustrationAlignedWithHeading: Math.round(image.getBoundingClientRect().top) === Math.round(heading.getBoundingClientRect().top),
        heroHeight: Math.round(hero.getBoundingClientRect().height),
        imageWidth: Math.round(image.getBoundingClientRect().width),
        heroLeft: Math.round(hero.getBoundingClientRect().left),
        heroWidth: Math.round(hero.getBoundingClientRect().width),
        heroImageRightOffset: Math.round(image.getBoundingClientRect().right - hero.getBoundingClientRect().left),
        navigationWidth: Math.round(navigation.getBoundingClientRect().width),
        viewportWidth: window.innerWidth,
        navigationRule: getComputedStyle(navigation).borderBottom,
        featuredHeadingFontSize: getComputedStyle(featuredHeading.querySelector('h2')!).fontSize,
        featuredDividerHeight: getComputedStyle(featuredDivider).height,
        navigationControlsLeft: Math.round(filters.getBoundingClientRect().left),
        navigationControlsWidth: Math.round(filters.getBoundingClientRect().width),
        featuredHeadingLeft: Math.round(featuredHeading.getBoundingClientRect().left),
        firstCardLeft: Math.round(firstCard.getBoundingClientRect().left),
        featuredHeadingWidth: Math.round(featuredHeading.getBoundingClientRect().width),
        featuredLinkRightOffset: Math.round(featuredLink.getBoundingClientRect().right - featuredHeading.getBoundingClientRect().left),
      };
    });
    expect(typography.shelfBackground).toBe('rgb(240, 238, 233)');
    expect(typography.headingColor).toBe('rgb(55, 81, 95)');
    expect(typography.headingFont).toContain('Cormorant Garamond');
    expect(typography.headingFontSize).toBe('46px');
    expect(typography.headingBreaks).toBe(1);
    expect(typography.subtitleColor).toBe(typography.headingColor);
    expect(typography.subtitleFont).toContain('Pretendard');
    expect(typography.subtitleFontSize).toBe('16px');
    expect(typography.subtitleFontWeight).toBe('400');
    expect(typography.subtitleLineHeight).toBe('26px');
    expect(typography.heroHeight).toBe(296);
    expect(typography.categoryToHeadingGap).toBe(56);
    expect(typography.headingToSubtitleGap).toBe(24);
    expect(typography.categoryToImageGap).toBe(56);
    expect(typography.illustrationAlignedWithHeading).toBe(true);
    expect(typography.imageWidth).toBe(400);
    expect(typography.heroWidth).toBe(1020);
    expect(typography.heroImageRightOffset).toBeLessThanOrEqual(typography.heroWidth);
    expect(typography.navigationWidth).toBe(typography.viewportWidth);
    expect(typography.navigationRule).toBe('2px solid rgb(55, 81, 95)');
    expect(typography.navigationControlsLeft).toBe((typography.viewportWidth - 1020) / 2);
    expect(typography.navigationControlsWidth).toBe(1020);
    expect(typography.featuredHeadingLeft).toBe(typography.navigationControlsLeft);
    expect(typography.firstCardLeft).toBe(typography.navigationControlsLeft);
    expect(typography.heroLeft).toBe(typography.navigationControlsLeft);
    expect(typography.featuredHeadingWidth).toBe(1020);
    expect(typography.featuredLinkRightOffset).toBe(1020);
    expect(typography.featuredHeadingFontSize).toBe('28px');
    expect(typography.featuredDividerHeight).toBe('1px');
    await expect(page.locator('.public-featured-heading').getByRole('link', { name: /View all titles/ })).toBeVisible();
    await expect(page.locator('.public-featured-divider')).toBeVisible();
    expect(requests.some((url) => /^https:\/\/fonts\.googleapis\.com\/css/i.test(url))).toBe(false);
  });

  test('serves the immutable PNG hero byte-for-byte from the app', async ({ page }) => {
    await page.goto('/');
    const heroUrl = await page.locator('.public-hero-image').getAttribute('src');
    expect(heroUrl).toMatch(/\.png(?:$|\?)/);

    const response = await page.request.get(new URL(heroUrl!, page.url()).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/^image\/png(?:;|$)/);

    const [servedBytes, sourceBytes] = await Promise.all([
      response.body(),
      readFile('item_01.png'),
    ]);
    const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    expect(servedBytes.equals(sourceBytes)).toBe(true);
    expect(hash(sourceBytes)).toBe('a035150e540b580101aa30c4d0c8d90ad85d6c43cfb8c44379c51bb43cd8f6ec');
    expect(hash(servedBytes)).toBe('a035150e540b580101aa30c4d0c8d90ad85d6c43cfb8c44379c51bb43cd8f6ec');
  });

  test('pins every local WOFF2 font to its declared release and bytes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute('href', '/fonts/cormorant-garamond-600.woff2');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute('type', 'font/woff2');
    const expectedFonts = [
      { family: 'Cormorant Garamond', weight: 600, emittedLocalUrl: '/fonts/cormorant-garamond-600.woff2', pinnedReleaseVersion: 'v4.002', licenseIdentifier: 'SIL-OFL-1.1', format: 'woff2', rawByteSize: 204052, sha256: 'af765967938cc1bd47f6de51c0b7992f22ebbd4b58f1fd8c1f37a3dbb80b26c3' },
      { family: 'Pretendard', weight: 400, emittedLocalUrl: '/fonts/pretendard-400.woff2', pinnedReleaseVersion: 'v1.3.9', licenseIdentifier: 'SIL-OFL-1.1', format: 'woff2', rawByteSize: 765892, sha256: 'fad853f7f47c6c8b103171e7193fa095708cdcd70850a71d93aa5379e8a61d63' },
      { family: 'Pretendard', weight: 500, emittedLocalUrl: '/fonts/pretendard-500.woff2', pinnedReleaseVersion: 'v1.3.9', licenseIdentifier: 'SIL-OFL-1.1', format: 'woff2', rawByteSize: 778432, sha256: 'd03481330eeba0659ab5b87f25ceb504a35de377dd90a0d0aba2982eb2d05e2c' },
      { family: 'Pretendard', weight: 600, emittedLocalUrl: '/fonts/pretendard-600.woff2', pinnedReleaseVersion: 'v1.3.9', licenseIdentifier: 'SIL-OFL-1.1', format: 'woff2', rawByteSize: 785856, sha256: 'c863f76a7de5c1ddc1ed8b2fa794964530774592c4f31407a84e2a2ae93f17f0' },
    ];
    const manifestResponse = await page.request.get(new URL('/fonts/manifest.json', page.url()).href);
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json() as { schemaVersion: number; fonts: Array<typeof expectedFonts[number]> };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.fonts).toHaveLength(expectedFonts.length);

    for (const [index, font] of manifest.fonts.entries()) {
      expect(font).toMatchObject(expectedFonts[index]!);
      const [localBytes, response] = await Promise.all([
        readFile(`public${font.emittedLocalUrl}`),
        page.request.get(new URL(font.emittedLocalUrl, page.url()).href),
      ]);
      const servedBytes = await response.body();

      expect(localBytes.byteLength).toBe(font.rawByteSize);
      expect(createHash('sha256').update(localBytes).digest('hex')).toBe(font.sha256);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toMatch(/font|octet-stream/i);
      expect(servedBytes.byteLength).toBe(font.rawByteSize);
      expect(createHash('sha256').update(servedBytes).digest('hex')).toBe(font.sha256);
      expect(servedBytes.equals(localBytes)).toBe(true);
      await expect.poll(() => page.evaluate(async ({ family, weight }) => {
        await document.fonts.load(`${weight} 1em "${family}"`);
        return document.fonts.check(`${weight} 1em "${family}"`);
      }, font)).toBe(true);
    }
  });

  test('fills public book cover frames by default on the desktop shelf', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const layout = await page.locator('.book-card').evaluateAll((cards) => cards.slice(0, 4).map((card) => {
      const cardRect = card.getBoundingClientRect();
      const coverRect = card.querySelector<HTMLElement>('.cover-frame')!.getBoundingClientRect();
      const category = card.querySelector<HTMLElement>('.category')!;
      const title = card.querySelector<HTMLElement>('strong')!;
      const creator = card.querySelector<HTMLElement>('.book-creators')!;
      const image = card.querySelector<HTMLImageElement>('img')!;
      const cardStyle = getComputedStyle(card);
      return {
        cardWidth: Math.round(cardRect.width),
        cardHeight: Math.round(cardRect.height),
        cardTop: Math.round(cardRect.top),
        cardBorder: cardStyle.border,
        cardBorderRadius: cardStyle.borderRadius,
        cardShadow: cardStyle.boxShadow,
        coverWidth: Math.round(coverRect.width),
        coverHeight: Math.round(coverRect.height),
        categoryFontSize: getComputedStyle(category).fontSize,
        categoryLineHeight: getComputedStyle(category).lineHeight,
        titleFontSize: getComputedStyle(title).fontSize,
        titleLineHeight: getComputedStyle(title).lineHeight,
        creatorFontSize: getComputedStyle(creator).fontSize,
        creatorLineHeight: getComputedStyle(creator).lineHeight,
        creatorParts: creator.children.length,
        contentFits: card.scrollHeight <= card.clientHeight,
        objectPosition: getComputedStyle(image).objectPosition,
        objectFit: getComputedStyle(image).objectFit,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
    }));

    expect(layout).toHaveLength(4);
    expect(new Set(layout.map((card) => card.cardTop)).size).toBe(1);
    expect(new Set(layout.map((card) => card.cardWidth)).size).toBe(1);
    for (const card of layout) {
      expect(card.cardWidth).toBe(240);
      expect(card.cardHeight).toBeGreaterThanOrEqual(430);
      expect(card.cardBorder).toBe('1px solid rgb(216, 211, 204)');
      expect(card.cardBorderRadius).toBe('10px');
      expect(card.cardShadow).toBe('rgba(55, 81, 95, 0.08) 0px 4px 12px 0px');
      expect(card.coverWidth).toBe(240);
      expect(card.coverHeight).toBe(350);
      expect(card.categoryFontSize).toBe('10px');
      expect(card.categoryLineHeight).toBe('14px');
      expect(card.titleFontSize).toBe('15px');
      expect(card.titleLineHeight).toBe('18px');
      expect(card.creatorFontSize).toBe('10px');
      expect(card.creatorLineHeight).toBe('16px');
      expect(card.creatorParts).toBeGreaterThanOrEqual(2);
      expect(card.contentFits).toBe(true);
      expect(card.objectFit).toBe('cover');
      expect(card.objectPosition).toBe('50% 50%');
    }
    await expect(page.locator('.book-sticky-note')).toHaveCount(1);
    await expect(page.locator('[data-sticky-note-kind="sold"]')).toHaveCount(0);
    await expect(page.locator('[data-sticky-note-kind="awards"]')).toHaveCount(1);
    await expect(page.locator('[data-sticky-note-kind="sold-awards"]')).toHaveCount(0);

    const position1Note = page.getByRole('img', { name: 'Awards: You Are Gone!' });
    await expect(position1Note).toHaveAttribute('src', /sticky-label-award[^/]*\.svg(?:$|\?)/);
    const position1Card = page.locator('.book-card[data-book-id="you-are-gone"]');
    const position1Shell = page.locator('.book-card-shell').filter({ has: position1Card });
    const position1 = await position1Shell.evaluate((shell) => {
      const card = shell.querySelector<HTMLElement>('.book-card')!.getBoundingClientRect();
      const note = shell.querySelector<HTMLElement>('[data-sticky-note-position="top-right"]')!.getBoundingClientRect();
      const nextCard = shell.nextElementSibling?.querySelector<HTMLElement>('.book-card')?.getBoundingClientRect();
      return {
        overlapRatio: (card.right - note.left) / note.width,
        outsideRatio: (note.right - card.right) / note.width,
        gapToNextCard: nextCard ? nextCard.left - note.right : null,
      };
    });
    expect(position1.overlapRatio).toBeGreaterThan(.85);
    expect(position1.overlapRatio).toBeLessThan(.95);
    expect(position1.outsideRatio).toBeGreaterThan(.05);
    expect(position1.outsideRatio).toBeLessThan(.15);
    expect(position1.gapToNextCard).toBeGreaterThanOrEqual(8);
  });
  test('preloads sticky note artwork before fast category navigation', async ({ page }) => {
    await page.goto('/');

    const preloadFiles = await page.locator('link[rel="preload"][as="image"]').evaluateAll((links) => links.map((link) => new URL((link as HTMLLinkElement).href).pathname));
    expect(preloadFiles).toHaveLength(3);
    expect(preloadFiles.filter((path) => path.includes('sticky-label-'))).toHaveLength(3);

    await page.getByRole('button', { name: 'Language Learning', exact: true }).click();
    const note = page.getByRole('img', { name: 'Sold and awards: Language Learning Swipe Test Series 1' });
    await expect(note).toBeVisible();
    expect(await note.evaluate((image: HTMLImageElement) => ({
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      decoding: image.decoding,
      fetchPriority: image.fetchPriority,
    }))).toEqual({
      complete: true,
      naturalWidth: 512,
      decoding: 'sync',
      fetchPriority: 'high',
    });
  });
  test('derives sticky note artwork from awards and rights metadata', async ({ page }) => {
    await page.goto('/');
    const publicCard = page.locator('.book-card[data-book-id="star-cat-village-4"]');
    await expect(publicCard.locator('.book-sticky-note')).toHaveCount(0);
    await openManagement(page);

    const management = page.locator('.management-section').filter({ has: page.getByRole('heading', { name: '책 관리' }) });
    await management.locator('button[data-book-id="star-cat-village-4"]').click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '편집', exact: true }).click();
    const kind = dialog.getByLabel('스티키 노트 종류');
    const position = dialog.getByLabel('스티키 노트 위치');
    await expect(kind).toBeDisabled();
    await expect(kind).toHaveValue('none');
    await expect(position).toBeDisabled();

    await dialog.getByLabel('rightsSold').fill('Japan');
    await expect(kind).toHaveValue('sold');
    await expect(position).toBeEnabled();
    await position.selectOption('bottom-left');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(page.getByRole('img', { name: 'Rights sold: Starry Cat Village 4' })).toHaveAttribute('data-sticky-note-position', 'bottom-left');

    await openManagement(page);
    await management.locator('button[data-book-id="star-cat-village-4"]').click();
    await dialog.getByRole('button', { name: '편집', exact: true }).click();
    await dialog.getByLabel('awards').fill('Best Picture Book');
    await expect(kind).toHaveValue('sold-awards');
    await dialog.getByLabel('rightsSold').fill('');
    await expect(kind).toHaveValue('awards');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(page.getByRole('img', { name: 'Awards: Starry Cat Village 4' })).toHaveAttribute('data-sticky-note-position', 'bottom-left');

    await openManagement(page);
    await management.locator('button[data-book-id="star-cat-village-4"]').click();
    await dialog.getByRole('button', { name: '편집', exact: true }).click();
    await dialog.getByLabel('awards').fill('');
    await expect(kind).toHaveValue('none');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(publicCard.locator('.book-sticky-note')).toHaveCount(0);
  });
  test('filters cover risks and persists a manual public presentation override', async ({ page }) => {
    await page.goto('/');
    const publicIds = await page.locator('.book-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-book-id')));
    await openManagement(page);

    const management = page.locator('.management-section').filter({ has: page.getByRole('heading', { name: '책 관리' }) });
    await expect(management.getByRole('group', { name: '자동 표지 상태 필터' })).toBeVisible();
    await expect(management.getByLabel('전체')).toBeChecked();
    await expect.poll(() => management.locator('.cover-status:not(.cover-status-loading)').count()).toBeGreaterThan(0);
    await management.getByLabel('검토 필요').check();
    await expect(management.locator('.cover-status-review, .cover-status-exception, .cover-status-unavailable').first()).toBeVisible();

    const target = management.locator('.manage-list > li:has(.cover-status-review), .manage-list > li:has(.cover-status-exception), .manage-list > li:has(.cover-status-unavailable)').locator('button[data-book-id]').first();
    const bookId = await target.getAttribute('data-book-id');
    expect(publicIds).toContain(bookId);
    await target.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '편집', exact: true }).click();
    await dialog.getByLabel('표지 표시 방식').selectOption('contain');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(page.locator(`.book-card[data-book-id="${bookId}"] .book-cover`)).toHaveCSS('object-fit', 'contain');

    await openManagement(page);
    await page.locator(`button[data-book-id="${bookId}"]`).click();
    await dialog.getByRole('button', { name: '편집', exact: true }).click();
    await dialog.getByLabel('표지 표시 방식').selectOption('auto');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByRole('button', { name: '상세 닫기' }).click();
    await page.getByRole('button', { name: '공개 서가 보기' }).click();
    await expect(page.locator(`.book-card[data-book-id="${bookId}"] .book-cover`)).toHaveCSS('object-fit', 'cover');
  });

  test('keeps the public editorial shelf within the narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
  test('flows card titles naturally without disturbing grid rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(300);
    const layout = await page.locator('.book-card').evaluateAll((cards) => cards.slice(0, 8).map((card) => {
      const cover = card.querySelector<HTMLElement>('.cover-frame')!;
      const title = card.querySelector<HTMLElement>('strong')!;
      const creator = card.querySelector<HTMLElement>('.book-creators')!;
      return {
        coverTop: Math.round(cover.getBoundingClientRect().top),
        creatorTop: Math.round(creator.getBoundingClientRect().top),
        titleBottom: Math.round(title.getBoundingClientRect().bottom),
        creatorParts: creator.children.length,
        titleMinBlockSize: getComputedStyle(title).minBlockSize,
      };
    }));

    expect(new Set(layout.slice(0, 4).map((card) => card.coverTop)).size).toBe(1);
    expect(new Set(layout.slice(4).map((card) => card.coverTop)).size).toBe(1);
    expect(layout[4].coverTop).toBeGreaterThan(layout[0].coverTop);
    for (const card of layout) {
      expect(card.creatorTop - card.titleBottom).toBe(6);
      expect(card.titleMinBlockSize).toBe('auto');
      expect(card.creatorParts).toBeGreaterThanOrEqual(2);
    }
    const longCards = page.locator('[data-book-id="science-explorers-17"], [data-book-id="language-learning-swipe-test-1"]');
    await expect(longCards).toHaveCount(2);
    const bottomGaps = await longCards.evaluateAll((cards) => cards.map((card) => {
      const metadata = card.querySelector<HTMLElement>('.book-creators')!;
      return Math.round(card.getBoundingClientRect().bottom - metadata.getBoundingClientRect().bottom);
    }));
    for (const gap of bottomGaps) expect(gap).toBeGreaterThanOrEqual(12);
  });
  test('shows covers without a separate image animation or geometry change', async ({ page }) => {
    await page.goto('/');
    const cover = page.locator('.book-cover').first();
    await expect(cover).toBeVisible();
    await expect(cover).toHaveCSS('opacity', '1');
    expect(await cover.evaluate((element) => element.getAnimations().length)).toBe(0);
    const box = await cover.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });
  test('keeps editorial covers free of the superseded sheen treatment', async ({ page }) => {
    await page.goto('/');
    const coverFrame = page.locator('.book-card').first().locator('.cover-frame');
    await expect(coverFrame).toBeVisible();
    expect(await coverFrame.evaluate((element) => getComputedStyle(element, '::after').content)).toBe('none');
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
    expect(layout.publicationCount).toBe(7);
    expect(layout.isbnHeight).toBeLessThanOrEqual(16);
    expect(layout.titleFits).toBe(true);
    expect(layout.titleWhiteSpace).toBe('normal');
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
  test('keeps a long detail title visible across responsive widths', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 844 });
    await page.goto('/');
    await page.locator('.book-card').first().click();
    const title = page.locator('.detail-title');
    await expect(title).toBeVisible();

    for (const width of [800, 631, 596, 481, 439, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await title.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(width <= 500 ? 'normal' : 'nowrap');
    }
  });


  test('keeps motion off when reduced motion is requested', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const heroHeading = page.locator('#public-hero-heading');
    await expect(heroHeading).toHaveCSS('opacity', '1');
    expect(await heroHeading.evaluate((element) => element.getAnimations().length)).toBe(0);
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
  test('groups shelf series and isolates volume slider gestures from popup navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Language Learning', exact: true }).click();
    const seriesCard = page.locator('.book-card').filter({ has: page.locator('strong', { hasText: 'Language Learning Swipe Test Series' }) });
    await expect(seriesCard).toHaveCount(1);
    await expect(seriesCard.locator('strong')).toHaveText('Language Learning Swipe Test Series');
    await expect(seriesCard.locator('.book-cover')).toHaveAttribute(
      'src',
      /language-learning-swipe-test-1\.webp$/,
    );
    await seriesCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 1 / 3');
    await expect(dialog.getByRole('heading', { name: '시리즈' })).toBeVisible();
    const volumes = dialog.locator('.series-volume-card');
    await expect(volumes).toHaveCount(3);
    await expect(volumes.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(volumes.nth(0).locator('span')).toHaveCount(0);
    await expect(volumes.nth(0).locator('img')).toHaveAttribute(
      'src',
      /language-learning-swipe-test-1\.webp$/,
    );
    await expect(dialog.getByText('테스트 데이터 · 2026 ChoiceMaker 샘플 컬렉션 추천', { exact: true })).toBeVisible();
    await expect(dialog.getByText('언어 학습, 낱말 탐색, 종이비행기, 테스트 시리즈', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /시리즈 권 목록/ })).toHaveCount(0);
    expect(await volumes.nth(0).evaluate((card) => ({
      borderTopWidth: getComputedStyle(card).borderTopWidth,
      indicatorColor: getComputedStyle(card, '::after').backgroundColor,
      indicatorHeight: getComputedStyle(card, '::after').height,
    }))).toEqual({ borderTopWidth: '0px', indicatorColor: 'rgb(111, 157, 58)', indicatorHeight: '2px' });
    await expect(dialog.getByRole('button', { name: /이전 권:/ })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /다음 권:/ })).toBeVisible();
    expect(await dialog.locator('.dialog-content').evaluate((node) => {
      const style = getComputedStyle(node);
      return style.overflowX === 'hidden' && style.overflowY === 'auto' && style.scrollbarWidth === 'none';
    })).toBe(true);
    expect(await dialog.locator('.series-detail-stage').evaluate((node) => {
      const style = getComputedStyle(node);
      return style.overflowX === 'hidden' && node.querySelectorAll('.series-detail-page').length === 0;
    })).toBe(true);

    const slider = dialog.locator('.series-volume-track');
    await slider.scrollIntoViewIfNeeded();
    expect(await slider.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.overflowX === 'auto' && style.scrollbarWidth === 'none' && style.flexWrap === 'nowrap';
    })).toBe(true);
    const sliderBox = await slider.boundingBox();
    if (!sliderBox) throw new Error('Series volume slider is not visible.');
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.75, sliderBox.y + sliderBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.25, sliderBox.y + sliderBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => slider.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => slider.evaluate((node) => {
      const maximum = node.scrollWidth - node.clientWidth;
      return Math.min(...Array.from(node.querySelectorAll<HTMLElement>('.series-volume-card')).map((card) => (
        Math.abs(node.scrollLeft - Math.min(maximum, card.offsetLeft))
      )));
    }), { timeout: 1_000 }).toBeLessThanOrEqual(1);
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 1 / 3');

    await slider.hover();
    await page.mouse.wheel(120, 0);
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 1 / 3');

    await volumes.nth(1).click();
    const nextVolume = dialog.getByRole('button', { name: /다음 권:/ });
    await nextVolume.click();
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 2 / 3');
    await expect(volumes.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(volumes.nth(1).locator('img')).toHaveAttribute(
      'src',
      /language-learning-swipe-test-2\.webp$/,
    );
    await expect(dialog.getByText('테스트 데이터 · 2026 ChoiceMaker 샘플 컬렉션 언어 감각 부문 추천', { exact: true })).toBeVisible();
    await expect(dialog.getByText('언어 감각, 알파벳, 문장 연결, 숲속 탐험', { exact: true })).toBeVisible();
    await page.waitForTimeout(250);

    const popupSwipeArea = dialog.locator('.detail-heading');
    await popupSwipeArea.scrollIntoViewIfNeeded();
    await popupSwipeArea.hover();
    await page.mouse.wheel(120, 0);
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 3 / 3');
    await expect(dialog.getByRole('button', { name: /다음 권:/ })).toHaveCount(0);
    const dialogContent = dialog.locator('.dialog-content');
    await page.waitForTimeout(250);
    await dialogContent.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect.poll(() => dialogContent.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

    await volumes.nth(1).click();
    await expect.poll(() => dialogContent.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => dialogContent.evaluate((node) => node.scrollTop)).toBe(0);
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 2 / 3');

    await page.waitForTimeout(250);
    await popupSwipeArea.scrollIntoViewIfNeeded();
    await popupSwipeArea.hover();
    await page.mouse.wheel(120, 0);
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 3 / 3');
    const seriesStage = dialog.locator('.series-detail-stage');
    await page.waitForTimeout(250);
    await page.mouse.wheel(120, 0);
    await expect(seriesStage).toHaveAttribute('data-boundary-feedback', 'active');
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 3 / 3');
    await expect(seriesStage).not.toHaveAttribute('data-boundary-feedback', 'active');

    const popupSwipeBox = await popupSwipeArea.boundingBox();
    if (!popupSwipeBox) throw new Error('Popup swipe area is not visible.');
    await page.mouse.move(popupSwipeBox.x + popupSwipeBox.width * 0.25, popupSwipeBox.y + popupSwipeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(popupSwipeBox.x + popupSwipeBox.width * 0.75, popupSwipeBox.y + popupSwipeBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(dialog.locator('.series-navigation')).toHaveText('Language Learning Swipe Test Series · 2 / 3');
  });
  test('adds new JSON catalog books and persists them locally', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const initialBookCount = await page.getByRole('region', { name: '책 목록' }).getByRole('button').count();

    await page.getByRole('button', { name: 'Comics & Graphic Novels', exact: true }).click();
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
    expect(exportedCatalog).toMatchObject({ schemaVersion: 1, catalogVersion: 6 });
    expect(exportedCatalog.books).toHaveLength(17);
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
    await expect(publicCatalog.getByRole('button')).toHaveCount(14);
    await expect(publicCatalog.getByRole('button', { name: /Imported Test Book/ })).toHaveCount(0);
  });
});
