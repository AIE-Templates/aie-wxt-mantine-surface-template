# Surface 선택 기능 가이드

[English](surface-recipes.md) | [简体中文](surface-recipes.zh-CN.md) | [日本語](surface-recipes.ja.md) | [한국어](surface-recipes.ko.md)

아래 기능과 예시는 필요할 때만 사용합니다. 새로운 진입점이나 개발 절차를 강제하지 않으며 기본 외관과 주입 범위도 바꾸지 않습니다.

## 애플리케이션 테마와 방향

글꼴, 이름이 있는 팔레트, Mantine virtual color, 컴포넌트 기본값은 `src/react-app/theme.ts`에서 정의합니다. 초기 기본 색상 설정은 `src/react-app/theme-defaults.ts`에 있습니다. 브랜드 색상을 기본으로 사용하려면 해당 팔레트 이름을 지정하세요. 이미 저장된 사용자 설정이 우선하며 기본값을 바꿔도 초기화되지 않습니다.

병합 순서는 애플리케이션 테마 → 선택한 기본 색상 → Surface 격리 설정입니다. 이름이 있는 색상은 병합된 테마에서 찾고 HEX 값은 팔레트를 생성합니다. Surface는 rem 배율과 Shadow UI의 Portal 대상, 스크롤 잠금, 떠 있는 요소의 기본값을 마지막에 설정합니다. 다만 컴포넌트에 명시적으로 전달한 props는 테마 기본값을 덮어쓸 수 있으므로 주입 UI에서 격리 설정을 덮어쓰지 마세요.

`useVisual()`의 방향 설정, 저장, Surface 간 동기화는 유지됩니다. `dir`은 각 Surface와 Satellite의 자체 루트에 기록하며 호스트 페이지의 `<html>`은 수정하지 않습니다. 독립된 확장 페이지는 자신의 `<html>`을 소유하므로 이를 수정하는 것이 정상입니다. 언어와 방향의 연결은 애플리케이션이 결정합니다.

## 동적 밝은/어두운 테마

기존 `extension`, `force-light`, `force-dark` 전략을 계속 사용할 수 있습니다. 구독 가능한 데이터 소스를 전달해 Surface의 테마를 동적으로 제어할 수도 있습니다.

```ts
import { createColorSchemeSource } from '@/surface/color-scheme';

const scheme = createColorSchemeSource('light');
// In the existing content entrypoint's createShadowSurfaceUi options:
// colorSchemeStrategy: scheme,

// Your application updates this same source instance:
scheme.set('dark');
```

이 소스를 `createShadowSurfaceUi` 또는 `documentSurface`의 `colorSchemeStrategy`로 전달합니다. 매 render마다 새로 만들지 말고 같은 인스턴스를 유지하면서 `set`으로 갱신하세요. Surface마다 별도로 만들거나 의도적으로 공유할 수 있습니다.

기존 상태 관리 시스템에서는 `ColorSchemeSource`를 직접 구현해도 됩니다. `getSnapshot()`은 `light` 또는 `dark`를 동기적으로 반환하고 `subscribe(listener)`는 구독 해제 함수를 반환합니다. 두 함수의 참조는 안정적이어야 하며 `this` 바인딩에 의존하면 안 됩니다. Provider가 언마운트되거나 소스가 바뀌면 구독이 해제됩니다.

외부 소스는 저장된 확장 전체의 테마 설정을 변경하지 않습니다. `useVisual().setColorScheme()`은 계속 확장 설정을 바꾸지만 외부 소스나 고정 전략이 제어하는 화면을 덮어쓰지는 않습니다. 이런 Surface에서는 설정 버튼을 숨기거나 버튼이 확장 전체의 설정을 바꾼다는 점을 설명하세요.

## 선택 모듈: 호스트 테마 따라가기

```ts
import { followHostColorScheme } from '@/surface/addons/host-scheme';

// In the existing shadow surface's options:
// colorSchemeStrategy: followHostColorScheme,
```

코어는 이 모듈을 import하지 않습니다. import만으로 observer나 이벤트 리스너가 시작되지 않습니다. 첫 구독자가 생기면 공유 감시를 시작하고 마지막 구독자가 떠나면 감시와 예약된 작업을 정리합니다.

감지기는 html/body 배경색을 합성하고 브라우저 캔버스의 color-scheme도 고려합니다. 루트 속성, OS 색상 설정, 페이지가 다시 보이는 시점, 배경 전환을 감시합니다.

이는 휴리스틱입니다. 배경 이미지, 화면 전체를 덮는 자식 컨테이너, CSSOM만의 변경이나 스타일시트 교체는 즉시 또는 정확히 감지하지 못할 수 있습니다. 호스트가 신뢰할 수 있는 테마 신호를 제공한다면 자체 `ColorSchemeSource`로 교체하세요. 이 감지기의 대상은 호스트 위의 Shadow UI이며 확장 자체의 독립 페이지가 아닙니다.

실제 브라우저에서는 기존 content 진입점에 일시적으로 활성화한 뒤 일반 테마 전환, CSS transition, OS 미디어 쿼리에 의한 전환을 확인합니다. 호스트 속성이 수정되지 않고 언마운트 시 감시가 해제되는지도 확인하세요. happy-dom 테스트는 상태와 구독을 검증하며 실제 렌더링과 전환을 재현하지는 않습니다.

## RPC 클라이언트와 백그라운드 경계

Echo 예제는 `src/core/rpc/echo/contract.ts`와 `impl.ts`로 나뉩니다. UI는 contract에서 `getEchoService`를 import하고 백그라운드는 impl에서 `registerEchoService`를 import합니다. 클라이언트용 barrel에서 구현을 다시 export하지 마세요. 타입 전용 import는 런타임 의존성을 번들에 포함하지 않고 서비스를 표현할 수 있습니다.

기존 ESLint 설정은 템플릿 RPC의 좁은 경계만 보호합니다. 하위 프로젝트의 서비스 구조를 강제하거나 모든 전이 의존성을 분석하지는 않습니다. CI나 번들 크기 예산도 추가하지 않습니다.

## 여러 진입점과 iframe

iframe에는 각각 별도의 document와 content-script 컨텍스트가 있습니다. 최상위 페이지의 입력·선택 이벤트 리스너가 iframe 내부의 이벤트를 자동으로 받지는 않습니다.

기존 `src/entrypoints/content/index.tsx`는 최상위 프레임 UI로 유지합니다. 기능상 필요할 때만 React/Mantine을 import하지 않는 가벼운 DOM 진입점을 추가하세요. UI 진입점에서 allFrames를 활성화했다면 main 시작 부분에 `if (window.self !== window.top) return;`을 넣어 떠 있는 UI가 중복되지 않도록 합니다.

선택적으로 추가할 `src/entrypoints/frame-events.content.ts`의 예시입니다. 문서 속 예시이므로 기본적으로 생성되거나 주입되지 않습니다.

```ts
import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  matchAboutBlank: true,
  cssInjectionMode: 'manual',
  main(ctx) {
    ctx.addEventListener(document, 'selectionchange', () => {
      // Handle this frame's selection here. No React or Mantine import needed.
    });
  },
});
```

`allFrames`는 여전히 URL 일치, 권한, 브라우저 제한을 따릅니다. `matchAboutBlank`는 조건에 맞는 blank/srcdoc 자식 프레임에 유용하지만 모든 제한을 우회하는 기능은 아닙니다. matches는 용도에 맞게 좁히세요. 프레임 간 협력에는 명시적인 frame 대상을 지정하는 확장 메시징을 사용하고, 진입점의 로드 순서에 의존하거나 다른 출처의 DOM을 직접 읽지 마세요.

## 비동기 초기화와 정리

WXT의 기존 생명주기를 사용합니다. 비동기 초기화를 기다리기 전에 무효화 시 정리할 작업을 등록하고, 각 await 뒤에 `ctx.isInvalid`를 확인한 다음 UI나 observer를 시작합니다.

`ctx.addEventListener`는 컨텍스트가 무효화되면 정리됩니다. storage watch와 MutationObserver는 `ctx.onInvalidated`에서 명시적으로 해제합니다. watch를 먼저 등록하더라도 늦게 도착한 초기 읽기가 최신 변경을 덮어쓰지 않도록 revision 확인이 필요합니다.

```ts
import { defineContentScript, storage } from '#imports';
import { PROJECT_PREFIX } from '@/constants';

const enabled = storage.defineItem<boolean>(`local:${PROJECT_PREFIX}:example:enabled`, {
  fallback: true,
});

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'manual',
  async main(ctx) {
    let revision = 0;
    const observer = new MutationObserver(() => {
      // Handle relevant mutations in this document.
    });
    const apply = (active: boolean) => {
      if (ctx.isInvalid) return;
      observer.disconnect();
      if (active) observer.observe(document, { childList: true, subtree: true });
    };
    const unwatch = enabled.watch((value) => {
      revision++;
      apply(value);
    });
    ctx.onInvalidated(() => {
      revision++;
      unwatch();
      observer.disconnect();
    });

    const initialRevision = revision;
    try {
      const value = await enabled.getValue();
      if (ctx.isInvalid || revision !== initialRevision) return;
      apply(value);
    } catch (error) {
      if (!ctx.isInvalid) console.warn('Could not initialize example setting', error);
    }
  },
});
```

fetch에는 `ctx.signal`을 전달하고 abort를 처리하세요. 요청 취소가 모든 비동기 작업의 종료를 뜻하지는 않으므로 await 이후에도 상태를 확인해야 합니다. start/stop이 겹치면 두 작업 모두 generation을 증가시키고 await 이후 검증합니다. 컨텍스트가 유효해도 개별 작업은 이미 대체되었을 수 있습니다.

`await createShadowSurfaceUi(...)` 이후, `ui.mount()` 이전에도 무효화를 확인합니다. 기존 진입점처럼 `onRemove`를 React root의 언마운트에 연결하고 초기화 Promise 실패를 처리하세요. 별도의 생명주기 프레임워크는 필요하지 않습니다.
