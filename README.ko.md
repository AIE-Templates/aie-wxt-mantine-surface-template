# aie-wxt-mantine-surface-template

> 선택 테마 모듈, RPC 경계, 여러 진입점 / iframe 및 생명주기 정리 예시: [Surface 도입 가이드](docs/surface-recipes.ko.md).

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md) | **한국어**

[![Use this template](https://img.shields.io/badge/Use_this_template-2ea44f?style=flat&logo=github&logoColor=white)](https://github.com/AIEPhoenix/aie-wxt-mantine-surface-template/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AIEPhoenix/aie-wxt-mantine-surface-template)
![WXT](https://img.shields.io/badge/WXT-0.21-67D55E)
![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

브라우저 확장 프로그램 사용자 인터페이스 구축을 위한 프로덕션 레벨의 견고한 보일러플레이트입니다. 단일 코드베이스로 작성된 UI는 팝업, 사이드 패널, 옵션 페이지, 독립 탭, 그리고 호스트 페이지에 주입되는 Shadow DOM 환경에 이르기까지 일관되고 완벽하게 렌더링됩니다.

본 템플릿은 완벽한 CSS 격리 환경을 보장합니다. 확장 프로그램의 스타일이 호스트 페이지에 영향을 미치지 않으며, 반대로 호스트 페이지의 전역 CSS가 확장 프로그램의 렌더링을 방해하지 않습니다.

**기술 스택:** WXT 0.21, `@webext-core` (메시징 및 RPC 서비스), Mantine 9.3 (네이티브 CSS 변수 기반, Emotion 의존성 완전 제거), Tailwind 4 (엄격한 네임스페이스 격리), 그리고 CSS Modules.

## 이 템플릿을 선택해야 하는 이유

- **UI는 한 번만 작성하고, 어디에나 마운트** —— 단일 컴포넌트 트리가 팝업, 사이드 패널, 옵션 페이지, 독립 탭, 또는 임의의 웹 페이지 주입으로 렌더링됩니다.
- **희망이 아닌, 진짜 shadow-DOM 격리** —— 알려진 스타일 침투 경로를 모두 처리하고 `pnpm audit:css`로 잠급니다.
- **Chrome가 실제로 로드하는 빌드 산출물** —— Vite 8 / rolldown 경로를 위한 ASCII 출력 플러그인, `pnpm audit:ascii`로 보호됩니다 (wxt#353).
- **네이티브 CSS 변수 기반 Mantine v9** —— Emotion 런타임 없음. 색상 스킴, 텍스트 방향, 기본 색상이 모든 surface 간에 동기화됩니다.
- **타입 완비, 테스트 완료, 문서화 완비** —— TypeScript, vitest 단위 테스트, 다국어 문서를 기본 제공.

> [!NOTE]
> 본 프로젝트는 비대한 프레임워크가 아닌, 확장 프로그램 개발의 기반이 되는 코어 템플릿입니다. `src/` 디렉터리의 핵심 코드는 환경 격리와 통신 등 확장 프로그램 개발에서 가장 까다로운 기반 작업(Plumbing)을 해결하는 데 집중합니다. 인증 플로우, HTTP/SSE 클라이언트, 복잡한 다중 환경 빌드 등 애플리케이션 고유의 비즈니스 로직은 의도적으로 제외되었습니다. 이러한 구현에 대한 권장 사항은 [디자인 패턴](#6-고급-디자인-패턴-선택-사항) 섹션을 참고하시기 바랍니다.

---

## 1. 시작하기

Node.js 22.12+ 및 pnpm 10.7.1이 필요합니다. WXT 0.21은 Vite 8을 사용하며 브라우저 자동 시작을 위해 `web-ext`를 명시적으로 설치합니다. 생성되는 TypeScript 설정은 새로운 엄격한 검사를 유지합니다.

Content 진입점은 `cssInjectionMode: 'manual'`을 사용하고 `virtual:surface-css`를 `createShadowSurfaceUi`에 전달합니다. 빌드 플러그인은 CSS Modules를 포함한 처리된 CSS 전체를 스크립트에 삽입하여 `chrome-extension://` 스타일시트 요청을 없앱니다. 일반 CSS import를 유지하며 별도의 모듈 스타일 목록은 필요하지 않습니다. 개발 모드에서도 WXT는 각 content 진입점을 개별 빌드합니다. 출력 CSS는 감사용이며 호스트 페이지에 로드되지 않고 `pnpm zip` 패키지에도 포함되지 않습니다. `pnpm audit:surface` 또는 `pnpm audit:surface:firefox`로 삽입된 CSS와 출력 파일이 같은지 검사합니다. 문서 표면은 일반 스타일시트 로딩을 유지합니다.

```bash
pnpm install
pnpm dev                 # Chrome: 확장 프로그램이 로드된 개발용 브라우저를 실행합니다
pnpm dev:firefox         # Firefox
```

`pnpm dev` 명령어를 실행하면, 페이지 내 주입(in-page injection) UI 컴포넌트를 테스트하기 위한 로컬 호스트 페이지가 함께 시작됩니다. (내부적으로 `python3 -m http.server -d test-pages 8787`이 실행되며 `http://localhost:8787`에서 서비스됩니다.)

### 환경 설정 및 커스터마이징

1. **네임스페이스 설정:** `PROJECT_PREFIX`의 단일 진실 공급원（single source of truth）은 저장소 루트의 **`prefix.cjs`**에 있습니다. 이 한 줄만 변경하면 `src/constants`, `postcss.config.cjs`, `scripts/audit-css-vars.mjs`가 모두 자동으로 따라갑니다. 수동으로 동기화해야 하는 곳은 `global.css`뿐입니다（CSS는 상수를 import할 수 없음）——그 안의 `.aie-surface-root` 셀렉터와 `--aie-z-*` 변수를 일치하도록 수정하십시오. 이 미러를 잊으면 확실하게 감지됩니다: `pnpm test`가 실패하고 `pnpm dev` / `pnpm build`는 `check-prefix-sync` Vite 플러그인을 통해 경고하거나 빌드를 중단합니다. 이 접두사는 CSS 변수와 핵심 서피스 루트 클래스에 네임스페이스를 부여하여 호스트 페이지와의 스타일 충돌을 차단합니다.
2. **Manifest 구성:** `wxt.config.ts` 파일의 `manifest` 함수 내에서 `name`과 `permissions`를 조정하십시오. 코드는 Manifest V3(MV3) 표준을 준수하여 작성해야 하며, WXT가 빌드 시 Firefox를 위한 MV2 다운그레이드를 자동 처리합니다.
3. **확장 프로그램 ID 고정 (선택 사항):** `.env.example`을 `.env` 파일로 복사하고 `WXT_EXTENSION_KEY`를 설정하십시오. 이를 통해 환경 변수를 이용해 Manifest의 `key`를 안전하게 주입할 수 있습니다. 빌드 산출물에는 `WXT_` 또는 `VITE_` 접두사가 포함된 환경 변수만 포함됩니다. 보안을 위해 민감한 정보는 버전 관리 시스템에 커밋되지 않는 `.env`에 보관하십시오.
4. **UI 인터페이스 추가:** `src/entrypoints/` 디렉터리 하위의 각 진입점(Entry Point)은 `src/react-app/apps/` 내의 특정 React 애플리케이션을 마운트하는 역할을 수행합니다. 새로운 화면을 추가하려면 기존 앱 디렉터리를 복제하고 해당 진입점을 구성하면 됩니다.
5. **콘텐츠 스크립트 범위 좁히기:** 데모용 콘텐츠 스크립트는 모든 `http`/`https` 페이지에 매칭되며(`src/entrypoints/content/index.tsx`의 `matches`), 콘텐츠 스크립트는 코드 분할이 불가능하므로 각 페이지에 Mantine + React 전체 번들(CSS를 포함한 약 802 kB JS)이 주입됩니다. 데모로는 문제없지만 실제 제품에서는 `matches`를 실제 대상 사이트로 좁히거나, 넓은 매칭을 유지하되 마운트를 지연시키십시오(사용자 조작 시 동적 import). 광범위한 호스트 권한은 스토어 심사에서 추가 검토 대상이 되기도 합니다.

### 빌드 및 배포

```bash
pnpm compile && pnpm lint && pnpm build
pnpm test                # vitest: 컴포넌트 생명주기, 스토리지 및 순수 로직의 불변성을 검증합니다 (happy-dom + fake-browser 환경)
pnpm audit:css           # CSS 변수의 스코프 안전성을 검사합니다 (Tailwind 또는 Mantine 업데이트 후 실행 권장)
pnpm audit:ascii         # 빌드 결과물이 순수 ASCII 문자로만 구성되었는지 보장합니다 (Chrome 확장 로드 시 CJK/UTF-8 관련 에러 방지)
pnpm audit:surface       # 각 content script가 전체 CSS를 내장하는지 검사합니다 (manifest 주입이나 web-accessible 스타일시트 없음)
                         # 세 감사 모두 `:firefox` 변형이 있어 `pnpm build:firefox` 산출물을 검사합니다

pnpm zip                 # Chrome Web Store 배포를 위한 zip 아카이브를 생성합니다 (AMO 배포의 경우 `pnpm zip:firefox` 사용)
```

---

## 2. 프로젝트 아키텍처

```text
src/
├── entrypoints/      # WXT 진입점 (자동 탐지됨) — 경량화된 마운트 레이어
│   ├── background.ts
│   ├── popup/        # index.html + main.tsx (options/, sidepanel/, tab/ 구조 동일)
│   └── content/      # 페이지 삽입 스크립트 (content script, index.tsx)
├── react-app/        # 애플리케이션 핵심 비즈니스 로직
│   ├── apps/         # 각 진입점에 매핑되는 독립적인 React 앱
│   ├── components/   # 공통 UI 컴포넌트 라이브러리
│   ├── managers/     # VisualManager (테마 동기화 관리), Mantine 레지스트리
│   ├── hooks/        # 확장 프로그램 전용 Hooks (예: useExtStorage)
│   └── styles/       # 전역 스타일 global.css, Mantine SCSS mixins
├── surface/          # 코어 격리 메커니즘: documentSurface, createShadowSurfaceUi, createSatellite
├── core/             # 컨텍스트 간 통신 채널: 메시징 및 RPC 서비스
└── constants/        # 네임스페이스 접두사, Z-Index 계층 정의, 공유 디자인 토큰
public/               # 빌드 시 원본 그대로 복사되는 정적 리소스 디렉터리
vite-plugins/         # 커스텀 빌드 플러그인 (예: UTF-8 문자열 이스케이프 처리기)
wxt.config.ts         # WXT 및 Vite 설정 파일, Manifest 정의 및 브라우저 타겟 구성
```

`src/entrypoints/`는 WXT가 자동으로 스캔하는 유일한 디렉터리입니다. 그 외의 모든 모듈은 표준 애플리케이션 코드로 취급되어 `@/` 별칭을 통해 임포트되며, WXT가 제공하는 확장 API는 가상 모듈인 `#imports`를 통해 참조합니다. 모든 진입점은 `src/react-app/apps/`에서 해당하는 애플리케이션을 마운트하기 위한 최소한의 shim 역할만 수행합니다.

> **아키텍처 설계 배경:** 이러한 구조는 WXT의 기본 적인 평면적 자동 임포트 규칙(`hooks/`와 `utils/`를 소스 루트에 두는 방식)에서 의도적으로 벗어난 것입니다. 애플리케이션 코드를 `react-app/` 내부에 응집시키고 명시적인 임포트를 강제함으로써, 더욱 엄격하고 견고한 모듈 경계를 확립했습니다. WXT의 `#imports` 기능 자체는 필요한 위치에서 여전히 완벽하게 지원됩니다.

---

## 3. 핵심 개념

| 인터페이스 유형 | 팩토리 메서드                              | 주요 유즈 케이스                                       | 인스턴스 제한 |
| --------------- | ------------------------------------------ | ------------------------------------------------------ | ------------- |
| **Document**    | `documentSurface()` + `renderSurfaceApp()` | 팝업, 사이드 패널, 옵션 페이지, 독립 탭                | 페이지당 1개  |
| **Shadow**      | `createShadowSurfaceUi()`                  | 호스트 페이지에 주입되는 독립적이고 무거운 UI          | 프레임당 1개¹ |
| **Satellite**   | `createSatellite()`                        | 툴바, 뱃지 등 가벼운 UI 컴포넌트                       | 제한 없음     |
| **Content**     | 해당 사항 없음 (디자인 패턴 참조)          | 호스트 페이지의 네이티브 DOM 조작 및 직접적인 스타일링 | 제한 없음     |

¹ `createShadowSurfaceUi`는 기술적으로 다중 인스턴스를 지원하지만, 현재 Satellite 레지스트리는 단일 호스트에 바인딩되도록 설계되었습니다.

**일반적인 가이드라인:**

- **UI 렌더링의 격리:** React DOM은 반드시 격리된 환경(Isolated World) 내에서 렌더링해야 합니다. 메인 환경(Main World)은 호스트 페이지의 네이티브 JavaScript 컨텍스트 접근이 필수적인 헤드리스(Headless) 로직을 위해서만 사용하십시오.
- **Surface 및 Content 트랙의 선택:** 레이아웃의 제어를 호스트 페이지에 위임해야 하는 경우, 표준 DOM 제어 방식(Content 트랙)을 사용하십시오. 확장 프로그램이 UI의 테마와 레이아웃을 완전히 제어해야 한다면 독립된 Surface 환경을 도입하십시오.

### 통합 환경 추상화 (`SurfaceEnv`)

독립된 Document 환경이든 임베디드 Shadow DOM 환경이든 관계없이, 마운트 지점의 물리적 차이는 통합된 인터페이스(`surface/defs.ts`)로 추상화되어 `MantineRegistry`에 제공됩니다.

```typescript
interface SurfaceEnv {
  kind: 'document' | 'shadow';
  rootElement: HTMLElement; // Mantine 변수 및 data-mantine-* 속성이 할당되는 호스트 노드
  portalTarget: HTMLElement; // Modal, Popover 등 플로팅 레이어의 마운트 타겟
  scale: number; // 동적 Rem 보정 계수 (16 / 호스트의 실제 rem 기준값). Document 환경에서는 항상 1입니다.
  colorSchemeStrategy: 'extension' | 'force-light' | 'force-dark';
}
```

**`document.body`에 대한 직접적인 조작은 엄격히 금지됩니다.** 모든 DOM 접근은 `useSurface()` 훅을 통해 안전하게 수행하십시오.

### 위성 컴포넌트 (Satellites)

Satellite는 호스트 페이지에 주입되는 매우 가볍고 타겟팅된 UI 컴포넌트입니다. 호스트 Surface가 초기화 단계에서 무거운 React Provider와 전역 스타일을 단 한 번만 로드하며, 이후 추가되는 각 Satellite는 빈 Shadow 컨테이너, 공유된 `CSSStyleSheet` 참조, 그리고 React Portal만을 이용하여 렌더링을 완료합니다.

`createSatellite()`를 사용하여 콘텐츠를 `SatelliteOutlet`으로 매핑하십시오. Outlet의 마운트 수명 주기는 `renderSurfaceApp`에 의해 자동으로 관리됩니다.

Satellites는 기본적으로 `isolateEvents` 메커니즘을 내장하고 있어, 확장 프로그램 내 사용자의 키보드 입력이 호스트 페이지의 단축키를 의도치 않게 트리거하는 것을 방지합니다. 내부적으로 `MutationObserver`가 DOM 트리를 감시하여 Satellite의 정확한 배치를 유지합니다.

- **자동 언마운트:** 호스트 요소 또는 앵커가 DOM 트리에서 제거되는 즉시 컴포넌트는 언마운트됩니다.
- **원활한 재배치:** 문서 흐름상 앵커 요소의 위치가 변경될 경우 컴포넌트가 이를 감지하여 자동으로 위치를 재조정합니다.

컴포넌트의 스타일은 Constructable Stylesheets를 통해 효율적으로 공유됩니다. 대상 브라우저가 이를 지원하지 않을 경우, 시스템은 안전하게 `<style>` 태그 클론 모드로 폴백(Fallback)합니다. (참고: 개발 모드에서는 호스트 페이지의 엄격한 콘텐츠 보안 정책(CSP)으로 인해 동적으로 주입된 `<link>` 태그가 차단될 수 있습니다. 스타일의 최종 검증은 `<style>` 태그를 안전하게 인라인 처리하는 프로덕션 빌드 산출물에서 수행하십시오.)

### 테마 관리

`useVisual()`은 테마 관련 로직을 처리하는 통합 훅입니다. Mantine의 네이티브 훅을 직접 호출하는 대신 이 훅을 사용하십시오.

- 컬러 스킴 관리 (`light`, `dark` 또는 `auto`).
- 텍스트 렌더링 방향 (Surface 전용 Context와 루트 속성으로 `ltr` / `rtl`을 지원하며 호스트의 방향은 변경하지 않습니다).
- 기본 색상 선택: 이름이 있는 팔레트(사용자 정의 색상과 virtual color 포함)는 애플리케이션 테마에서 찾고 HEX 값은 10단계 팔레트를 생성합니다.

### 상태 동기화

각 Surface 간의 상태 동기화는 WXT가 제공하는 Storage API에 의해 완벽하게 처리됩니다. 팝업에서 테마를 변경하면 페이지 내 주입된 UI도 실시간(밀리초 단위)으로 업데이트됩니다.

커스텀 반응형 상태를 동기화해야 할 경우, `useExtStorage` 훅을 사용하여 인스턴스 전반의 `storage.defineItem` 호출을 래핑하십시오. 이때 구성 객체나 배열의 대체 기본값(Fallback)은 불필요한 렌더링을 방지하기 위해 모듈 레벨의 안정적인 참조를 사용해야 합니다.

### 컨텍스트 통신

본 템플릿은 컨텍스트 간 통신을 위해 강력한 타입 추론을 지원하는 두 개의 채널을 제공합니다.

- **메시징 (`core/messaging`):** `ProtocolMap`에 통신 인터페이스를 등록하기만 하면, 송신 및 수신 측에서 타입이 완벽하게 보장되는 `sendMessage` 및 `onMessage` 메서드를 사용할 수 있습니다. 이는 기존의 취약한 문자열 기반 액션 식별자나 번거로운 이벤트 리스너 작성을 불필요하게 만듭니다.
- **RPC (`core/rpc`):** 클라이언트는 `core/rpc/echo/contract.ts`에서 인터페이스를 import하고 백그라운드는 `impl.ts`에서 구현을 import하여 등록합니다. `@webext-core/proxy-service`를 통해 어떠한 Surface에서든 마치 로컬 함수를 호출하듯 원격 메서드를 실행할 수 있습니다. 이 방식은 크로스 오리진 Fetch, 대용량 파일 다운로드, 장기 실행 작업 등 백그라운드 환경의 무거운 처리에 가장 이상적입니다.

---

## 4. Shadow DOM 제한 사항 및 대응 전략

Shadow DOM은 뛰어난 캡슐화를 제공하지만, CSS의 특정 상속 특성으로 인해 예기치 않은 부작용이 발생할 수 있습니다. 다음은 일반적인 엣지 케이스에 대한 대응 전략입니다.

| 문제 현상                   | 증상                                                              | 해결 방안                                                                            |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 속성 상속의 영향            | 호스트 페이지의 폰트 설정이 확장 프로그램 UI를 오염시킴           | `.aie-surface-root` 컨테이너 레벨에서 타이포그래피 초기화(Reset)를 엄격히 적용       |
| `rem` 기준치 누수           | 호스트의 비정상적인 `font-size`로 인해 UI 비율이 손상됨           | `theme.scale = 16 / 호스트 실제 rem 값`을 설정하여 역방향 동적 보정 적용             |
| `@property` 충돌            | Tailwind CSS 변수가 호스트 페이지 변수와 충돌함                   | `postcss.config.cjs`를 통해 `--tw-` 접두사를 `--aie-tw-`로 일괄 변환 적용 완료       |
| Tailwind `rem` 보정         | 호스트의 `rem` 변동으로 인해 Tailwind 간격 유틸리티가 무력화됨    | `.aie-surface-root` 영역에 `calc(x * var(--mantine-scale, 1))` 보정 계수를 강제 적용 |
| Modal의 `lockScroll`        | Modal 활성화 시 호스트 페이지 전체가 스크롤 불능 상태에 빠짐      | 모든 Modal 및 Drawer 컴포넌트에 대해 `lockScroll: false` 속성을 명시적으로 비활성화  |
| `lightningcss` 정밀도 문제  | 컴파일 시 과도하게 큰 `z-index` 값이 잘못 압축됨                  | `Z_INDEX` 상수의 유효 숫자를 6자리 이하로 제한하여 설계                              |
| 외부 문서 스타일의 덮어쓰기 | 호스트 페이지의 가중치가 높은 CSS가 확장 프로그램 스타일을 무시함 | UI 프레임워크의 CSS 변수를 `.aie-surface-root` 스코프 내부로 엄격히 제한             |

### CSS 변수 보안 전략

모든 루트 레벨 CSS 변수는 Shadow 트리 내부의 `.aie-surface-root` 스코프 내에 안전하게 격리되어 있습니다. 이는 외부의 불확실한 `:root` 또는 `:host` 선택자로부터 물리적인 분리를 보장합니다. 디자인 토큰의 스코프 무결성을 감사하기 위해 주기적으로 `pnpm audit:css`를 실행하십시오.

**Z-Index 계층 규약:** `src/constants`의 `Z_INDEX` 상수로 정의되며 `global.css`에 `--<prefix>-z-*` CSS 변수로 미러링됩니다（`src/constants/index.test.ts`의 테스트가 둘의 동기화를 보장합니다）.
우선순위: `floatUi < mainUi < modal < popover < notification < max`.

### 엄격한 CSP 호환성

호스트 페이지가 엄격한 Content-Security-Policy(예: `script-src 'self'; style-src 'self'; style-src-attr 'none'`, `unsafe-inline` 없음)를 설정하더라도 surface는 정상적으로 동작합니다. 콘텐츠 스크립트 JS는 isolated world에서 실행되며(페이지가 아닌 확장 프로그램 자체 CSP의 적용을 받음), surface의 스타일은 shadow root 내부에 배치됩니다——WXT가 주입하는 `<style>`, Mantine의 테마 변수, satellites의 `adoptedStyleSheets`——따라서 호스트의 `style-src`/`script-src`가 도달하지 못합니다. 예상되는 호스트 변경은 WXT가 페이지 `<head>`에 추가하는 `<style wxt-shadow-root-document-styles>` 하나뿐입니다. `@property` 규칙은 shadow root 안에서 동작하지 않으므로 WXT가 문서 수준으로 올립니다. 이 규칙은 접두사가 붙은 `--aie-tw-*` 속성만 등록하며 UI가 언마운트될 때 제거됩니다. Mantine이 색상 구성표 전환 시 주입하는 전환용 `<style>`은 범위가 지정되지 않은 두 번째 변경이 되므로 `keepTransitions: true`로 비활성화되어 있습니다. `pnpm build` 후 `test-pages/csp-strict-host.html`로 검증하십시오.

---

## 5. 아키텍처 핵심 원칙 (Hard Rules)

1. **`document.body` 조작 금지:** DOM 노드에 대한 모든 접근은 `useSurface()`를 통해 위임해야 합니다.
2. **호스트 환경 무결성 보호:** 확장 프로그램의 Modal, Drawer, Portal 컴포넌트는 호스트의 `document` 또는 `body` 스타일을 직접 수정해서는 안 됩니다.
3. **콘텐츠 UI에서 Emotion 사용 금지:** `<style>` 태그를 `document.head`에 동적 주입하는 CSS-in-JS 라이브러리는 Shadow Root 환경에서 치명적인 렌더링 실패를 초래합니다. 기본 제공되는 CSS Modules 및 Mantine의 네이티브 CSS 변수 기능을 사용하십시오.
4. **Satellite 컴포넌트의 활용:** 단일 버튼과 같은 사소한 상호작용을 위해 전체 Surface 인스턴스를 초기화하지 마십시오. Satellite를 활용한 경량화된 컴포넌트를 사용하십시오.
5. **Content 트랙의 단순성 유지:** 호스트 DOM을 직접 수정할 때 Tailwind 클래스나 React 노드를 사용하지 마십시오. 순수 Vanilla DOM API와 전용 접두사가 포함된 CSS 클래스만을 사용해야 합니다.
6. **인증 로직의 격리:** 보안 자격 증명과 관련된 UI 상호작용은 메인 환경(Main World)과 철저히 격리되어야 합니다.
7. **플로팅 컴포넌트의 명시적 제약:** 모든 Popover, Tooltip, Menu 컴포넌트는 명시적으로 `zIndex: Z_INDEX.popover` 및 `floatingStrategy: 'fixed'` 속성을 선언해야 합니다.
8. **네임스페이스 동기화 유지:** `PROJECT_PREFIX`는 `prefix.cjs`（단일 진실 공급원）에서만 변경하십시오. `src/constants`, `postcss.config.cjs`, CSS 감사는 이로부터 파생됩니다. 수동 미러는 `global.css`뿐이며, `pnpm test` / `pnpm build`가 드리프트를 방지합니다.

---

## 6. 고급 디자인 패턴 (선택 사항)

복잡한 비즈니스 시나리오를 위한 권장 구현 패턴은 다음과 같습니다.

### 6.1 Content 트랙의 활용

텍스트 강조 표시 또는 호스트 DOM 구문 분석 등의 작업은 Content Script 내에 Vanilla DOM 모듈을 캡슐화하여 처리해야 합니다. 확장 프로그램이 제어 로직을 소유하되 시각적인 렌더링은 호스트 페이지의 흐름에 맡기는 원칙을 준수하십시오.

- DOM 상호작용을 위한 앵커 포인트로 안전한 `data-aie-*` 속성을 사용하십시오.
- 복잡한 컴포넌트 상태 관리가 필요한 경우, 대상 노드 내부에 Satellite 컴포넌트를 마운트하십시오.

### 6.2 메인 환경 (Main-World) 브리지 구성

호스트 페이지에 노출된 네이티브 JS API 호출이 불가피한 예외적인 상황에서만 메인 환경으로 진입해야 합니다. 실행이 완료되면 크로스 사이트 스크립팅(XSS) 취약점을 방지하기 위해 `@webext-core/messaging/page`를 통해 결과 데이터를 즉시 격리된 환경(Isolated World)으로 반환해야 합니다.

### 6.3 기타 엔지니어링 사항

- **빌드 인코딩 최적화:** `vite-plugins/to-utf8.ts` 플러그인은 컴파일 단계에서 청크 내의 비 ASCII 문자를 안전한 UTF-8 이스케이프 시퀀스로 강제 변환합니다. 이는 CJK 문자 또는 이모지가 다수 포함된 번들 로드 시 Chrome이 발생시키는 "non-UTF-8" 파싱 오류를 사전 차단합니다. 기본으로 활성화되어 있으며 순수 ASCII 산출물에는 영향을 미치지 않습니다.
- **다중 환경 격리 빌드:** 개발(Dev) 환경과 프로덕션(Prod) 환경의 로직 분리가 필요한 경우, `wxt.config.ts` 파일의 `manifest` 함수 내에서 `mode` 환경 변수를 기준으로 조건 분기를 처리하십시오.
- **커스텀 Storage Hooks 설계:** 구체적인 구현 및 제약 사항은 `src/react-app/hooks/useExtStorage.ts` 파일의 가이드를 참조하십시오.

비즈니스 도메인에 종속적인 로직은 본 프레임워크의 설계 원칙에 따라 의도적으로 배제되었습니다. 커스텀 HTTP 클라이언트, OAuth 통합(`chrome.identity`) 또는 정교한 DOM 선택기 파서 등은 요구사항에 맞게 `src/services` 또는 `src/react-app/utils` 디렉터리에 개별적으로 구현하십시오.

### 6.4 마운트 진입점의 확장

팝업, 사이드 패널, 옵션 페이지 및 독립 탭은 이미 `documentSurface()` 엔진에 연동되어 있습니다. 신규 인터페이스 진입점을 추가하려면 기존의 Entrypoint 템플릿을 복제하여 라우팅 매핑만 조정하면 됩니다.

---

## 7. 알려진 제한 사항

- 현재의 아키텍처 구현 상, 단일 프레임 내의 Satellite 레지스트리는 단 한 개의 호스트 Surface 인스턴스에만 바인딩될 수 있습니다.
- Rem 기반의 동적 보정 계수는 초기화 라이프사이클 동안 단 한 번만 연산됩니다. 따라서 호스트 페이지 런타임 시 동적으로 최상위 루트 폰트 크기가 변경되더라도 확장 프로그램의 UI가 이에 맞추어 자동 재조정되지 않습니다.
- 내장된 `MutationObserver`는 기본적으로 DOM 트리 전체의 변이를 감시합니다. 노드 변경이 빈번하게 발생하는 무거운 단일 페이지 애플리케이션(SPA) 환경에서는 불필요한 CPU 사이클 낭비를 막기 위해 개발자가 직접 명시적인 해제(Teardown) 로직을 구현할 것을 권장합니다.
- 프레임워크가 제공하는 이벤트 격리 수준은 현재 버블링 단계(Bubble Phase)의 이벤트 전파 차단에 국한되어 동작합니다.

---

## 8. 기술 스택 및 참고 자료

본 템플릿이 기반으로 하는 핵심 의존성:

| 패키지                                    | 역할                                                            | 문서                                                         |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| WXT                                       | 확장 프로그램 프레임워크 — 진입점, manifest 생성, dev/build/zip | [wxt.dev](https://wxt.dev)                                   |
| `@webext-core` (messaging, proxy-service) | 타입 안전한 컨텍스트 간 메시징 + 백그라운드 RPC                 | [webext-core.aklinker1.io](https://webext-core.aklinker1.io) |
| Mantine                                   | 네이티브 CSS 변수 기반 UI 컴포넌트 및 테마                      | [mantine.dev](https://mantine.dev)                           |
| React (`@wxt-dev/module-react` 경유)      | UI 런타임 및 WXT React 모듈                                     | [react.dev](https://react.dev)                               |
| Tailwind CSS                              | 네임스페이스가 적용된 유틸리티 CSS (v4, lightningcss)           | [tailwindcss.com](https://tailwindcss.com)                   |
| TypeScript                                | 언어 및 타입 검사                                               | [typescriptlang.org](https://www.typescriptlang.org)         |
| Vite (rolldown)                           | WXT가 빌드에 사용하는 번들러                                    | [vite.dev](https://vite.dev)                                 |
| Vitest                                    | 단위 테스트 (happy-dom + fake-browser)                          | [vitest.dev](https://vitest.dev)                             |

정확한 버전은 `package.json`을 참조하십시오.
