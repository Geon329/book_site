---
version: 1.0.0
name: ChoiceMaker Editorial Design System
status: active
source: src/styles.css (.public-shelf)
---

# ChoiceMaker Editorial Design System

## 1. 정의

따뜻한 종이색 바탕 위에 청회색 세리프 타이포그래피, 얇은 구조선, 넓은 여백과 다채로운 책 표지를 배치하는 국제 출판권 카탈로그형 에디토리얼 시스템이다.

이 시스템은 일반 소비자용 아동 서점이 아니라 해외 출판사, 저작권 담당자와 에이전트를 위한 B2B 포트폴리오를 전제로 한다. 인터페이스는 절제하고 책 표지가 시각적 에너지를 담당한다.

## 2. 적용 범위와 기준 소스

- 공개 카탈로그와 회사 포트폴리오: 이 문서와 `src/styles.css`의 `.public-shelf` 토큰을 따른다.
- 관리 화면: 공통 접근성 규칙을 공유하지만 별도의 기능 중심 UI를 허용한다.
- 실제 값의 기준 소스는 `.public-shelf`의 `--editorial-*` CSS 사용자 정의 속성이다.
- 컴포넌트에서 색상, 컨테이너 폭, 주요 간격, Radius를 임의의 숫자로 다시 선언하지 않는다.
- 반응형 값은 동일 토큰을 미디어 쿼리에서 재정의한다.

## 3. 디자인 원칙

1. **Editorial** — 웹 앱보다 출판 카탈로그와 북페어 브로슈어에 가깝게 구성한다.
2. **Institutional** — 규칙적인 분류와 그리드로 선별·연결하는 전문기관의 인상을 유지한다.
3. **Warm Professional** — 웜 뉴트럴로 온기를, 청회색 Ink로 신뢰를 만든다.
4. **Curated, not Playful** — 장난스러운 장식 대신 책 표지에 색채와 개성을 맡긴다.
5. **Content First** — UI 장식이 표지, 권리 판매 상태와 서지 정보를 압도하지 않는다.

## 4. Foundation

### 4.1 Color

| 역할 | CSS 토큰 | 값 | 용도 |
|---|---|---:|---|
| Paper | `--editorial-paper` | `#F0EEE9` | 공개 화면 Canvas |
| Surface | `--editorial-surface` | `#FBFAF7` | 카드와 밝은 콘텐츠 면 |
| Primary Ink | `--editorial-ink` | `#37515F` | 제목, 주요 텍스트, 주요 행동 |
| Muted Ink | `--editorial-muted` | `#6E7680` | 보조 정보 |
| Divider | `--editorial-line` | `#D8D3CC` | 구조선과 카드 테두리 |
| Cool Accent | `--editorial-accent` | `#A8B7C4` | 제한적인 보조 강조 |
| Brand Green | `--editorial-brand-green` | `#619F3C` | Hover, Focus, 현재 위치 등 작은 브랜드 신호 |
| On Primary | `--editorial-on-primary` | `#FFFFFF` | Ink 표면 위 텍스트 |

Brand Green은 전체 화면 면적의 3~5% 이내에서 사용한다. 큰 배경 면이나 책 표지와 경쟁하는 장식에는 사용하지 않는다.

작은 본문과 Metadata는 배경 대비 4.5:1 이상을 유지한다. 낮은 opacity로 대비를 낮추지 말고 의미가 맞는 토큰을 사용한다.

### 4.2 Typography

| 역할 | CSS 토큰 | 서체 | 기본 규칙 |
|---|---|---|---|
| Display | `--editorial-font-display` | Cormorant Garamond 600 | 페이지·섹션 제목, 워드마크 |
| UI / Body | `--editorial-font-ui` | Pretendard 400/500/600 | 본문, 내비게이션, 버튼, Metadata |

- Hero: Display, 55~58px Desktop, line-height 약 0.98, 음수 자간
- Portfolio Hero: Display, 최대 70px Desktop
- Section heading: Display, 약 35~50px
- Body: UI, 17.5~20px Desktop
- Navigation: UI, 17.5px Desktop
- Card title: UI, 18.75px Desktop
- Metadata/Eyebrow: UI, 12~13px, 필요할 때 Uppercase와 넓은 자간
- 제목 위계는 색상 변화보다 서체, 크기와 여백으로 만든다.

### 4.3 Containers and Grid

| 역할 | CSS 토큰 | 현재 값 |
|---|---|---:|
| Wide Container | `--editorial-container-wide` | `1600px` |
| Catalogue Container | `--editorial-container-catalog` | `1600px` |
| Wide Gutter | `--editorial-gutter-wide` | `clamp(48px, 4vw, 72px)` |
| Desktop Card | `--editorial-card-width` | `270px` |
| Catalogue Gap | `--editorial-grid-gap` | `25px` |

Wide와 Catalogue는 현재 값이 같아도 의미가 다르므로 별도 토큰을 유지한다. 제목·Hero·서사 콘텐츠는 Wide, 책 카드와 카탈로그 콘텐츠는 Catalogue를 사용한다. 향후 폭을 조정할 때 컴포넌트가 아니라 토큰만 변경한다.

Grid는 Desktop에서 가용 폭에 따라 4~5열, Tablet 2~3열, Mobile 1열로 축소한다. 표지는 고정된 영역 안에서 원본 비율을 보존하며, 자르기가 콘텐츠 요구사항으로 명시되지 않은 경우 `object-fit: contain`을 기본으로 한다.

### 4.4 Spacing

| 단계 | CSS 토큰 | 값 |
|---|---|---:|
| Small section | `--editorial-section-space-sm` | `40px` |
| Medium section | `--editorial-section-space-md` | `72px` |
| Large section | `--editorial-section-space-lg` | `90px` |

Catalogue는 Small~Medium, Landing은 Medium, About/Story는 Medium~Large 호흡을 기본으로 한다. 컴포넌트 내부 간격은 기존 카드·Hero 토큰을 우선한다.

### 4.5 Shape and Elevation

| 역할 | CSS 토큰 | 값 |
|---|---|---:|
| Action | `--editorial-radius-action` | `4px` |
| Card | `--editorial-radius-card` | `10px`, Desktop `13px` |
| Pill | `--editorial-radius-pill` | `999px` |

- CTA는 약간 각지고, 콘텐츠 카드는 부드럽고, 계정·상태만 Pill을 사용한다.
- Divider는 기본 1px, 주요 내비게이션 경계는 2px까지 허용한다.
- Shadow는 카드와 Dialog처럼 계층 구분이 필요한 요소에만 낮게 적용한다.
- Glassmorphism, 강한 Gradient Shadow와 과도한 부유 효과는 사용하지 않는다.

### 4.6 Motion

| CSS 토큰 | 값 |
|---|---:|
| `--editorial-motion-duration` | `220ms` |
| `--editorial-motion-ease` | `cubic-bezier(0, 0, .58, 1)` |

Motion은 빠르게 튀지 않고 짧고 차분해야 한다. Hover 이동은 3px, 이미지 확대는 1.02, 화살표 이동은 4px을 상한으로 삼는다. `prefers-reduced-motion`에서는 비필수 이동을 제거한다.

## 5. Components

### Header

- Brand Row와 Category Navigation의 두 단 구조를 사용한다.
- Header에서는 로고와 Serif Wordmark가 서로 경쟁하지 않도록 크기 위계를 유지한다.
- About, Book Fairs, Contact는 Category와 구분되는 Utility Navigation으로 제공한다.
- Sticky Header를 도입할 경우 스크롤 상태의 전체 높이는 88~104px로 축소한다.

### Category Navigation

- 다섯 카테고리는 동일한 폭과 리듬을 갖는다.
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

1. Foundation 변경은 이 문서와 `.public-shelf` 토큰을 함께 수정한다.
2. 단일 컴포넌트의 예외를 새 전역 규칙처럼 복제하지 않는다.
3. 새 페이지는 Catalogue, Landing, Story 중 하나를 선택하거나 새 Template을 문서화한다.
4. 새로운 색상·Radius·Container를 추가하기 전에 기존 의미 토큰으로 해결 가능한지 확인한다.
5. 시각 변경은 Desktop, Tablet, Mobile과 키보드 Focus 상태를 검증한다.
