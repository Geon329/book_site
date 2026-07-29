import { createHash } from 'node:crypto';
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
  test('renders the public editorial shelf with its two-band header and English category filtering', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page).toHaveTitle('도서전 소개');
    await expect(page.locator('.public-header-primary')).toBeVisible();
    await expect(page.locator('.public-category-navigation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The ChoiceMaker Korea', level: 1 })).toBeVisible();
    await expect(page.getByRole('img', { name: 'The ChoiceMaker Korea', exact: true })).toBeVisible();
    await expect(page.locator('.public-header-brand')).toHaveText('The ChoiceMaker Korea');
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
    expect(headerBands.separators).toEqual(['16px', '16px', '16px', '16px']);

    const categories = page.locator('.public-category-navigation .filters button');
    await expect(categories).toHaveText(['Picture Books', 'Fictions', 'Educational Comics', 'Graphic Novels', 'Language Learning']);
    await expect(categories).toHaveCount(5);

    const initialCount = await page.locator('.book-card').count();
    const graphicNovels = page.getByRole('button', { name: 'Graphic Novels', exact: true });
    await graphicNovels.click();
    await expect(graphicNovels).toHaveAttribute('aria-pressed', 'true');
    await expect(graphicNovels).toHaveCSS('background-color', 'rgb(55, 81, 95)');
    await expect(graphicNovels).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(graphicNovels).toHaveCSS('background-image', 'none');
    await expect(page.locator('.public-hero')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Featured Titles', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Graphic Novels', level: 2, exact: true })).toBeVisible();
    await expect(page.locator('.public-featured-divider')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /View all titles/ })).toHaveCount(0);
    await expect.poll(() => page.locator('.book-card').count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('.book-card').count()).toBeLessThan(initialCount);
    expect(await page.locator('.book-cover').evaluateAll((covers) => covers.every((cover) => cover.getAnimations().length === 0))).toBe(true);
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
    await expect(page.getByRole('heading', { name: 'Graphic Novels', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Picture Books', level: 2, exact: true })).toBeVisible();

    await pictureBooks.click();
    await expect(pictureBooks).toHaveAttribute('aria-pressed', 'false');
    await expect(pictureBooks).toHaveCSS('background-image', 'none');
    await expect(page.locator('.book-card')).toHaveCount(initialCount);
    await expect(page.locator('.public-hero')).toBeVisible();
    await expect(page.locator('#public-hero-heading')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('heading', { name: 'Featured Titles', level: 2, exact: true })).toBeVisible();
    await expect(page.locator('.public-featured-divider')).toBeVisible();
    await expect(page.getByRole('link', { name: /View all titles/ })).toBeVisible();
  });

  test('uses public English category labels in management', async ({ page }) => {
    await page.goto('/');
    await openManagement(page);

    const categoryManagement = page.locator('.management-section').filter({ has: page.getByRole('heading', { name: '카테고리 관리' }) });
    await expect(categoryManagement.locator('.manage-list > li > span')).toHaveText(['Picture Books', 'Fictions', 'Educational Comics', 'Graphic Novels', 'Language Learning', 'Archived (예약됨)']);

    await categoryManagement.getByRole('button', { name: '이름 변경' }).first().click();
    await expect(categoryManagement.getByLabel('Picture Books 새 이름')).toHaveValue('Picture Books');
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
    await expect(hero.locator('.public-hero-copy > p')).toHaveCount(0);
    await expect(hero.locator('.public-hero-eyebrow')).toHaveCount(0);
    await expect(hero.getByRole('heading')).toContainText('Curated Stories.');
    await expect(hero.getByRole('heading')).toContainText('Worldwide Impact.');
    await expect(heroImage).toHaveAttribute('alt', 'The ChoiceMaker Korea의 어린이 책 컬렉션');
    await expect(heroImage).toHaveAttribute('src', /\.png(?:$|\?)/);

    const cta = hero.locator('.public-hero-cta');
    await expect(cta).toHaveText('Explore Our Collection →');
    await expect(cta).toHaveAttribute('href', '#featured-titles');
    await cta.click();
    await expect(page.locator('#featured-titles.public-featured')).toBeInViewport();

    const typography = await page.evaluate(() => {
      const shelf = document.querySelector<HTMLElement>('.public-shelf')!;
      const heading = document.querySelector<HTMLElement>('.public-hero h2')!;
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
    expect(typography.heroHeight).toBe(242);
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
      expect(card.cardHeight).toBe(430);
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
      expect(card.creatorLineHeight).toBe('14px');
      expect(card.objectFit).toBe('cover');
      expect(card.objectPosition).toBe('50% 50%');
    }
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
        titleMinBlockSize: getComputedStyle(title).minBlockSize,
      };
    }));

    expect(new Set(layout.slice(0, 4).map((card) => card.coverTop)).size).toBe(1);
    expect(new Set(layout.slice(4).map((card) => card.coverTop)).size).toBe(1);
    expect(layout[4].coverTop).toBeGreaterThan(layout[0].coverTop);
    expect(layout[1].creatorTop).toBe(layout[0].creatorTop);
    expect(layout[0].titleMinBlockSize).toBe('36px');
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
    expect(layout.publicationCount).toBe(5);
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
