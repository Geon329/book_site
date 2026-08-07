---
version: 1.1.0
name: ChoiceMaker Editorial Design System
status: active
source: src/styles.css (:root Foundation primitives and scoped semantic aliases)
---

# ChoiceMaker Editorial Design System

## 1. 정의

따뜻한 종이색 바탕 위에 청회색 세리프 타이포그래피, 얇은 구조선, 넓은 여백과 다채로운 책 표지를 배치하는 국제 출판권 카탈로그형 에디토리얼 시스템이다.

이 시스템은 일반 소비자용 아동 서점이 아니라 해외 출판사, 저작권 담당자와 에이전트를 위한 B2B 포트폴리오를 전제로 한다. 인터페이스는 절제하고 책 표지가 시각적 에너지를 담당한다.

## 2. 적용 범위와 기준 소스

- 실제 값의 단일 기준은 `src/styles.css`의 `:root --foundation-*` Primitive이다.
- 소비 순서는 **Foundation Primitive → 화면 Semantic Scope → Component** 한 방향만 허용한다. Scope 간 참조와 컴포넌트의 Foundation 직접 참조는 금지한다.
- Splash는 `.splash-page --splash-*`, Main/Portfolio는 `.public-shelf --editorial-*`, Management는 `.management-workspace`의 기능 중심 Semantic Alias를 사용한다.
- 전역 Top Layer는 `top-layer-context-public` 또는 `top-layer-context-management`를 반드시 가진다. Dialog의 배치·크기·Elevation은 공용 Chrome이 소유하고 Color, Typography, Focus, Link, Danger 의미는 Context가 소유한다.
- Bodoni Moda, Cormorant Garamond, Management 기능형 서체는 서로 바꾸지 않는다. 값이 같더라도 Wide/Catalogue Container처럼 역할이 다르면 별도 Alias를 유지한다.
- 컴포넌트 지역 값은 고유 Asset Geometry, 콘텐츠 구조 또는 Choreography에 결합된 경우에만 허용한다.

## 3. 디자인 원칙

1. **Editorial** — 웹 앱보다 출판 카탈로그와 북페어 브로슈어에 가깝게 구성한다.
2. **Institutional** — 규칙적인 분류와 그리드로 선별·연결하는 전문기관의 인상을 유지한다.
3. **Warm Professional** — 웜 뉴트럴로 온기를, 청회색 Ink로 신뢰를 만든다.
4. **Curated, not Playful** — 장난스러운 장식 대신 책 표지에 색채와 개성을 맡긴다.
5. **Content First** — UI 장식이 표지, 권리 판매 상태와 서지 정보를 압도하지 않는다.

## 4. Foundation

### 4.1 Token hierarchy

| 계층 | Prefix / Scope | 책임 |
|---|---|---|
| Primitive | `:root --foundation-*` | 공유 Raw Color, Font Family, Space, Radius, Shadow, Layer, Motion, Control, Container |
| Splash Semantic | `.splash-page --splash-*` | Bodoni Moda 기반 Splash의 편집 의미와 Entrance Motion |
| Main Semantic | `.public-shelf`, `.top-layer-context-public`, `--editorial-*` | Cormorant/Pretendard 기반 공개 카탈로그와 Portfolio |
| Management Semantic | `.management-workspace`, `.top-layer-context-management` | Noto/Georgia 기반 기능 중심 관리 UI |
| Component | 지역 사용자 정의 속성 | 카드·Sticky Note·Artwork·Dialog Geometry 등 고유 구조만 소유 |

동일 Raw 값은 Primitive 한 곳에서만 선언한다. Semantic Alias는 자신의 Context 의미를 이름 붙이고 Component는 해당 Alias만 소비한다.

### 4.2 Color

| Primitive | 값 | Main Alias / 용도 |
|---|---:|---|
| `--foundation-color-paper` | `#F0EEE9` | `--editorial-paper`, Canvas |
| `--foundation-color-surface` | `#FBFAF7` | `--editorial-surface`, Card/Dialog |
| `--foundation-color-editorial-ink` | `#37515F` | `--editorial-ink`, Main 제목·행동 |
| `--foundation-color-neutral-ink` | `#202B35` | Management 주요 Ink |
| `--foundation-color-muted` | `#6E7680` | `--editorial-muted`, Metadata |
| `--foundation-color-divider` | `#D8D3CC` | `--editorial-line`, 구조선 |
| `--foundation-color-brand-green` | `#619F3C` | Splash/Main의 제한적 Brand Signal |
| `--foundation-color-cool-accent` | `#A8B7C4` | 제한적 보조 강조 |

Brand Green은 전체 화면 면적의 3~5% 이내에서 사용한다. 작은 본문과 Metadata는 배경 대비 4.5:1 이상을 유지하고 opacity로 의미 대비를 낮추지 않는다.

### 4.3 Typography

| Context / 역할 | Semantic Alias | 서체 |
|---|---|---|
| Splash Display | `--splash-display` | Bodoni Moda 500 |
| Main Display | `--editorial-font-display` | Cormorant Garamond 600 |
| Main UI / Body | `--editorial-font-ui` | Pretendard 400/500/600 |
| Management Display | `--serif` | Georgia, Noto Serif KR |
| Management UI | `--sans` | Noto Sans KR, Inter, Arial |

Main의 1024px 이상 Native 값은 Hero 44~46.4px, Section Heading 28px, Card Title 15px, Metadata 10px이다. 900~1023px 구간은 기존 Desktop authored tier를 유지하되 정상 Viewport Container 안에서 배치한다. 제목 위계는 색상보다 서체, 크기와 여백으로 만든다.

### 4.4 Spacing, Shape, Elevation and Layer

- Foundation Space Scale은 4, 8, 12, 16, 20, 24, 28, 32, 40, 72, 90px이다.
- Main Section Alias는 Small 40px, Medium 72px, Large 90px을 기본으로 하며 1024px 이상 Native 변환값은 기존 post-zoom 시각값을 유지한다.
- Radius Primitive: Classic 2px, Action 4px, Field 8px, Card 10px, Cover 14px, Dialog 22px, Pill 999px.
- Shadow는 Card, Cover, Dialog, Floating Control처럼 계층 구분이 필요한 곳에만 사용한다.
- Layer Primitive는 Content 0, Raised 1, Overlay Control 2, Overlay Content 3, Modal 10이다. 임의 z-index를 추가하지 않는다.
- 모든 상호작용 Target은 렌더링 기준 최소 44×44 CSS px을 유지한다.

### 4.5 Layout and native scale

| 역할 | Main 900~1023px | Main 1024px 이상 |
|---|---:|---:|
| Wide / Catalogue 의미 폭 | `1275px` 상한 | `1280px` 상한 |
| Shelf rail | `1275px` 상한 | `1020px` 상한 |
| Card | `270px` | `216px` |
| Cover height | `394px` | `315.2px` |
| Catalogue gap | `25px` | `20px` |
| Wide gutter | `clamp(48px, 4vw, 72px)` | `clamp(38.4px, 3.2vw, 57.6px)` |

CSS `zoom`과 `125vw` 보정은 사용하지 않는다. 900px부터 Navigation은 정확히 Viewport 폭을 사용하고 Filter/Hero/Grid는 Container와 Gutter 안에서 정렬한다. 900~1023px는 과거 Overflow 결함을 교정한 구간이며, 1024px부터는 과거 `.8` post-zoom의 렌더링 Geometry를 Native CSS px 값으로 재현한다. Browser 확대/축소는 실제 Responsive Reflow로 처리한다.

### 4.6 Canonical condition registry

Media 조건은 CSS 변수로 추상화하지 않고 아래 Literal, 방향, 포함 경계와 Source Order를 유지한다.

| Context | 정확한 조건 |
|---|---|
| Splash | `max-width:1100px`, `max-width:800px` |
| Base | `min-width:768px`, `min-width:1200px`, `max-width:640px` |
| Detail | `max-width:700px`, `max-width:480px`, `max-width:360px` |
| Main | `max-width:960px`, `max-width:768px`, `max-width:640px`, `min-width:900px`, `900px–1200px`, `min-width:1024px`, `1024px–1200px` |
| Portfolio | `max-width:800px`, `max-width:640px` |
| Capability | fine hover, coarse/no hover, forced colors, reduced motion |

경계 QA는 N−1/N/N+1로 수행한다. 특히 899/900/901, 959/960/961, 1023/1024/1025를 고정 회귀 지점으로 둔다. `min-width:768px`와 `max-width:768px`는 768px에서 의도적으로 동시에 적용된다.

### 4.7 Motion

Foundation은 `160ms`, `220ms`, `cubic-bezier(0, 0, .58, 1)`을 제공하고 각 Context가 의미 Alias를 만든다. Hover 이동은 3px, 이미지 확대는 1.02, 화살표 이동은 4px을 상한으로 삼는다. `prefers-reduced-motion`에서는 비필수 이동을 제거한다.

Splash Page는 마운트마다 한 번, 최대 2300ms 안에서 절제된 편집형 순서로 등장한다. 첫 0~1180ms에는 가로선·세로선을 서로 다른 시작점과 길이로 그린다. 행사 부스 표기의 `/`는 글리프를 변형하지 않고 위에서 아래로 마스킹해 본래 사선 형태를 유지한 채 드러낸다. 선 전용 easing으로 시작과 끝에 충분한 장력을 두고, 1220ms부터 행사명 → 로고 → 브랜드 제목과 우측 행사 정보 → 설명 → CTA → 푸터 텍스트를 opacity와 최대 10px의 Y 이동으로 하나씩 드러낸다. CTA는 어느 단계에서든 즉시 Main Page로 이동하고 별도 퇴장 애니메이션을 두지 않는다. 텍스트에는 Scale·Blur·Spring·레이아웃 이동이나 상시 `will-change`를 사용하지 않는다. Reduced Motion에서는 즉시 완성 상태로 정착하고 같은 마운트에서 다시 재생하지 않는다.

## 5. Components

### Header

- Brand Row와 Category Navigation의 두 단 구조를 사용한다.
- Header에서는 로고와 Serif Wordmark가 서로 경쟁하지 않도록 크기 위계를 유지한다.
- About, Book Fairs, Contact는 Category와 구분되는 Utility Navigation으로 제공한다.
- Sticky Header를 도입할 경우 스크롤 상태의 전체 높이는 88~104px로 축소한다.

### Category Navigation

- Public Navigation은 `Picture Books`, `Fictions`, `Comics & Graphic Novels`, `Language Learning` 네 카테고리를 동일한 폭과 리듬으로 제공한다. `보관`은 Management 전용 분류이며 Public Navigation 개수에 포함하지 않는다.
- 현재 Active State는 Primary Ink Fill과 흰색 텍스트를 표준으로 한다.
- Hover는 구조를 움직이지 않고 텍스트 또는 작은 Brand Green 신호로 표현한다.
- Focus indicator는 색상만으로 표시하지 않고 명확한 outline을 제공한다.

### Audience Filter

- Fiction의 독자 연령 분류는 목차나 Sticky Rail이 아니라 제목 옆의 독립된 단일 선택 필터로 제공한다.
- 옵션은 All, Early Readers, Middle Grade, Young Adult 순서를 유지한다.
- 선택 상태는 Primary Ink 텍스트와 얇은 Primary Ink 하단선으로 표시한다.
- Desktop에서는 제목·Divider와 같은 행에 두고, Mobile에서는 제목 아래의 가로 스크롤 행으로 전환한다.
- 모든 화면 크기에서 필터 기능을 유지하며 Hover나 색상에만 상태 정보를 의존하지 않는다.

### Book Card

정보 순서는 다음을 유지한다.

1. 표지
2. Rights Sold / Awards 상태
3. 카테고리
4. 영문 제목
5. 저자·출판사 Metadata

상태 태그는 최대 두 개, 고정된 높이와 간격을 사용한다. 표지 전체를 가리는 큰 Badge는 금지한다. 카드 자체보다 표지가 먼저 보이도록 그림자와 Hover를 절제한다.

### Partner Marquee

- 로고는 셀의 기계적 크기가 아니라 optical size로 정규화한다.
- 원본의 흰색 박스, 내부 여백과 컬러 강도를 정리한다.
- 양 끝이 잘리는 경우 Gradient Mask로 이동 방향을 설명한다.
- 자동 이동은 느리고 일정하게 유지하며 Reduced Motion에서 정지한다.

### Illustration

책, 책등, 국가 간 연결선, 직선형 로고 구조와 지구의 곡선을 핵심 모티프로 사용한다. 일반적인 교육용 Stock Illustration 문법은 피한다. 볼펜 해칭과 종이 질감은 상태, Hover 또는 작은 강조에만 제한한다.

## 6. Page Templates

### Catalogue Template

`Global Header → Category Title → Catalogue Grid`

가장 높은 정보 밀도를 사용한다. 빠른 탐색과 표지 비교가 우선이다.

### Landing Template

`Global Header → Two-column Hero → Featured Titles → Trust Content`

중간 밀도를 사용하고 메시지와 카탈로그 진입을 균형 있게 배치한다.

### Story / About Template

`Eyebrow → Editorial Heading → Description → Brand Graphic → Partner Marquee → Book Fairs`

가장 넓은 여백과 느린 호흡을 사용한다. 페이지마다 밀도는 달라도 Color, Type, Divider와 Container 규칙은 공유한다.

## 7. Interaction and Accessibility

- 모든 Control은 최소 44px 터치 영역을 확보한다.
- 키보드 Focus는 항상 시각적으로 확인 가능해야 한다.
- Hover에만 핵심 정보를 숨기지 않는다.
- 상태는 색상 외에 텍스트나 아이콘으로도 전달한다.
- 본문 4.5:1, 큰 텍스트와 비텍스트 핵심 요소 3:1 이상의 대비를 유지한다.
- 움직이는 Marquee와 장식 Motion은 사용자가 줄일 수 있어야 한다.

## 8. 변경 규칙

1. Foundation 변경은 `:root --foundation-*`, 영향받는 Context Alias, 이 문서를 함께 수정한다.
2. 단일 컴포넌트의 예외를 새 전역 규칙처럼 복제하지 않는다.
3. 새 페이지는 Catalogue, Landing, Story 중 하나를 선택하거나 새 Template을 문서화한다.
4. 새로운 색상·Radius·Container를 추가하기 전에 기존 의미 토큰으로 해결 가능한지 확인한다.
5. 시각 변경은 Desktop, Tablet, Mobile과 키보드 Focus 상태를 검증한다.
6. Main 변경은 899/900/960/1023/1024 경계와 80/100/125/150% 확대축소 등가 Viewport에서 Overflow, Target, Grid를 검증한다.
7. Top Layer 추가 시 Public 또는 Management 소유자를 명시하고 Focus, Escape, Backdrop, Scroll, Reduced Motion 회귀를 검증한다.
