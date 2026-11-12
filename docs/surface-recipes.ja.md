# Surface の任意導入ガイド

[English](surface-recipes.md) | [简体中文](surface-recipes.zh-CN.md) | [日本語](surface-recipes.ja.md) | [한국어](surface-recipes.ko.md)

以下の機能と例は必要に応じて利用するものです。新しいエントリーポイントや開発手順を必須にせず、既定の外観と注入範囲も変更しません。

## アプリケーションのテーマと方向

フォント、名前付きパレット、Mantine の virtual color、コンポーネントの既定値は `src/react-app/theme.ts` で定義します。主色の初期設定は `src/react-app/theme-defaults.ts` にあります。ブランド色を既定にする場合は、対応するパレット名を指定してください。保存済みのユーザー設定が優先され、既定値の変更ではリセットされません。

マージ順序は「アプリケーションのテーマ → 選択された主色 → Surface の分離設定」です。名前付きの色はマージ後のテーマから解決し、HEX 値にはパレットを生成します。Surface は rem スケールと、Shadow UI の Portal の配置先、スクロールロック、フローティング要素の既定値を最後に設定します。ただし、明示的なコンポーネント props はテーマの既定値を上書きできます。注入 UI では分離設定を上書きしないでください。

`useVisual()` による方向設定、永続化、Surface 間の同期は維持されます。`dir` は各 Surface と Satellite のルートに設定し、ホストページの `<html>` は変更しません。独立した拡張ページは自分の `<html>` を所有するため、その更新は意図した動作です。言語から方向への対応付けはアプリケーションが担当します。

## 動的な明暗テーマ

既存の `extension`、`force-light`、`force-dark` は引き続き使用できます。購読可能なデータソースを渡して、Surface の表示を動的に制御することもできます。

```ts
import { createColorSchemeSource } from '@/surface/color-scheme';

const scheme = createColorSchemeSource('light');
// In the existing content entrypoint's createShadowSurfaceUi options:
// colorSchemeStrategy: scheme,

// Your application updates this same source instance:
scheme.set('dark');
```

このソースを `createShadowSurfaceUi` または `documentSurface` の `colorSchemeStrategy` に渡します。インスタンスを保持し、毎回の render で作り直さず `set` で更新してください。Surface ごとに作成することも、意図して共有することもできます。

既存の状態管理を使う場合は `ColorSchemeSource` を実装します。`getSnapshot()` は `light` または `dark` を同期的に返し、`subscribe(listener)` は購読解除関数を返します。両関数の参照は安定させ、`this` に依存させないでください。Provider のアンマウント時やソース切り替え時には購読が解除されます。

外部ソースは拡張全体の保存済み設定を書き換えません。`useVisual().setColorScheme()` は引き続き拡張の設定を変更しますが、外部ソースや固定戦略による表示には優先しません。このような Surface では設定ボタンを隠すか、変更対象が拡張全体の設定であることを説明してください。

## オプション：ホストページのテーマに追従

```ts
import { followHostColorScheme } from '@/surface/addons/host-scheme';

// In the existing shadow surface's options:
// colorSchemeStrategy: followHostColorScheme,
```

コアはこのモジュールを import しません。import だけでは observer やイベントリスナーは起動しません。最初の購読時に共有監視を開始し、最後の購読解除時に監視と予約済み処理を停止します。

検出器は html/body の背景色を合成し、ブラウザーのキャンバスの color-scheme も考慮します。ルート属性、OS の配色設定、ページの再表示、背景のトランジションを監視します。

これは推測に基づく検出です。背景画像、画面全体を覆う子コンテナー、CSSOM のみの変更やスタイルシートの差し替えは、正確または即座に検出できない場合があります。ホストが信頼できるテーマ情報を提供する場合は、独自の `ColorSchemeSource` に置き換えてください。対象はホスト上の Shadow UI であり、拡張自身の独立ページではありません。

実ブラウザーでは既存の content エントリーで一時的に有効化し、通常の明暗切り替え、CSS transition、OS メディアクエリーによる切り替えを確認します。ホストの属性が変更されず、アンマウントで監視が解除されることも確認してください。happy-dom のテストは状態と購読を検証するもので、実際の描画やトランジションを再現しません。

## RPC のクライアントとバックグラウンド

Echo は `src/core/rpc/echo/contract.ts` と `impl.ts` に分かれています。UI は contract から `getEchoService` を import し、バックグラウンドは impl から `registerEchoService` を import します。クライアント用の barrel から実装を再エクスポートしないでください。型のみの import は実行時依存をバンドルせずにサービスを表現できます。

既存の ESLint 設定は、このテンプレート RPC の狭い境界だけを保護します。下流プロジェクトのサービス構成を規定するものでも、推移的依存を完全に解析するものでもありません。アプリケーションのバンドルサイズの予算は規定しません。

## 複数のエントリーポイントと iframe

iframe は独自の document と content-script コンテキストを持ちます。トップページの入力・選択イベントのリスナーは、iframe 内のイベントを自動的には受け取りません。

既存の `src/entrypoints/content/index.tsx` はトップフレームの UI として維持します。機能上必要な場合のみ、React/Mantine を import しない軽量の DOM エントリーを追加します。UI エントリーで allFrames を有効にした場合は、main の先頭に `if (window.self !== window.top) return;` を置き、浮動 UI の重複を防いでください。

任意の `src/entrypoints/frame-events.content.ts` の例です。このファイルは文書内の例であり、既定では生成・注入されません。

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

`allFrames` は URL マッチ、権限、ブラウザーの制限に従います。`matchAboutBlank` は対象となる blank/srcdoc 子フレームに有用ですが、任意の制限を回避する機能ではありません。matches は用途に合わせて絞ってください。フレーム間の連携には明示的な frame 対象を持つ拡張メッセージングを使い、ロード順に依存したり、別オリジンの DOM を直接読み取ったりしないでください。

## 非同期初期化とクリーンアップ

WXT の既存ライフサイクルを利用します。非同期処理を待つ前に無効化時の処理を登録し、各 await の後に `ctx.isInvalid` を確認してから UI や observer を開始します。

`ctx.addEventListener` はコンテキスト無効化時に解除されます。storage の watch や MutationObserver は `ctx.onInvalidated` で明示的に解除します。先に watch を登録しても、初期読み取りが遅れて新しい変更を上書きしないよう revision の確認が必要です。

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

fetch には `ctx.signal` を渡し、abort を処理してください。ただしリクエストの中止は全非同期処理の終了を意味しないため、await 後の確認も必要です。start/stop が重なる場合は両操作で generation を進め、await 後に検証します。コンテキストが有効でも、個別の操作が置き換えられている可能性があります。

`createShadowSurfaceUi` は、コンテキストが無効化された後の `mount()` / `autoMount()` を無視し、無効化時に UI を削除します（`autoMount` も停止します）。それでも既存エントリーのように、`await` の後は `ctx.isInvalid` を確認してから他の処理を開始してください。あわせて `onRemove` を React root のアンマウントに接続し、初期化 Promise の失敗を処理してください。別のライフサイクルフレームワークは不要です。
