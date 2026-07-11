# aie-wxt-mantine-surface-template

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語** | [한국어](./README.ko.md)

[![Use this template](https://img.shields.io/badge/Use_this_template-2ea44f?style=flat&logo=github&logoColor=white)](https://github.com/AIEPhoenix/aie-wxt-mantine-surface-template/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AIEPhoenix/aie-wxt-mantine-surface-template)
![WXT](https://img.shields.io/badge/WXT-0.20-67D55E)
![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

ブラウザ拡張機能のユーザーインターフェースを構築するための、本番環境を見据えた堅牢なボイラープレートです。一度記述したUIは、ポップアップ、サイドパネル、オプションページ、独立したタブ、さらにはホストページに注入されるShadow DOM環境において、一貫して完璧に動作します。

本テンプレートは完全なCSSの分離を保証します。拡張機能のスタイル設定がホストページに影響を与えることはなく、またホストページのCSSが拡張機能に干渉することもありません。

**技術スタック:** WXT 0.20、`@webext-core` (メッセージングおよびプロキシサービス)、Mantine 9.3 (ネイティブCSS変数のみを使用し、Emotionには非依存)、Tailwind 4 (厳密な名前空間による分離)、および CSS Modules。

## このテンプレートを選ぶ理由

- **UIは一度だけ記述し、どこにでもマウント** —— 単一のコンポーネントツリーが、ポップアップ、サイドパネル、オプションページ、独立タブ、あるいは任意のWebページへの注入として動作します。
- **期待ではなく、本物のShadow DOM分離** —— 既知のスタイル貫通の経路はすべて処理され、`pnpm audit:css` によって固定されます。
- **Chromeが実際に読み込めるビルド** —— Vite 8 / rolldown パス向けのASCII出力プラグイン。`pnpm audit:ascii` で保護されます (wxt#353)。
- **ネイティブCSS変数で動くMantine v9** —— Emotionランタイムなし。カラースキーム、テキスト方向、プライマリカラーがすべてのサーフェス間で同期します。
- **型付き・テスト済み・ドキュメント完備** —— TypeScript、vitestユニットテスト、多言語ドキュメントを最初から同梱。

> [!NOTE]
> 本プロジェクトは、包括的なフレームワークではなく、拡張機能開発の基盤となるテンプレートです。`src/` 以下のコードは、拡張機能開発において複雑になりがちな環境分離や通信の基盤（プラミング）の解決に特化しています。認証フロー、HTTP/SSEクライアント、複雑なビルド環境といったアプリケーション固有のロジックは意図的に排除されています。これらの実装方針については、[デザインパターン](#6-デザインパターン-任意) のセクションをご参照ください。

---

## 1. はじめに

```bash
pnpm install
pnpm dev                 # Chrome: 拡張機能を読み込んだ状態の開発用ブラウザを起動します
pnpm dev:firefox         # Firefox
```

`pnpm dev` コマンドを実行すると、ページ内注入UIの動作確認用にローカルのテスト用ホストページも立ち上がります（バックグラウンドで `python3 -m http.server -d test-pages 8787` が実行され、`http://localhost:8787` で提供されます）。

### カスタマイズ設定

1. **名前空間の定義:** `PROJECT_PREFIX` の唯一の信頼できる情報源（single source of truth）は、リポジトリルートの **`prefix.cjs`** にあります。この一行を変更するだけで、`src/constants`、`postcss.config.cjs`、`scripts/audit-css-vars.mjs` がすべて自動的に追従します。手動で同期する必要があるのは `global.css` のみです（CSSは定数をインポートできないため）——その中の `.aie-surface-root` セレクタと `--aie-z-*` 変数を一致するように更新してください。このミラーを忘れても確実に検知されます: `pnpm test` が失敗し、`pnpm dev` / `pnpm build` は `check-prefix-sync` Vite プラグインによって警告またはビルド失敗となります。この接頭辞はCSS変数とコアとなるサーフェスルートクラスに名前空間を付与し、ホストページとのスタイルの衝突を防ぎます。
2. **Manifest の構成:** `wxt.config.ts` 内の `manifest` 関数にて `name` と `permissions` を調整してください。実装は Manifest V3 (MV3) に準拠して行います。Firefox向けのMV2へのダウングレードは、ビルド時にWXTが自動的に処理します。
3. **拡張機能IDの固定 (任意):** `.env.example` を `.env` にコピーし、`WXT_EXTENSION_KEY` を設定します。これにより、環境変数を通じてマニフェストの `key` が安全に注入されます。ビルド出力に組み込まれるのは `WXT_` または `VITE_` で始まる環境変数のみです。機密情報はバージョン管理対象外の `.env` で厳重に管理してください。
4. **UIの追加:** `src/entrypoints/` 配下の各エントリーポイントは、`src/react-app/apps/` にあるReactアプリケーションをマウントする役割のみを担います。新しい画面を追加する場合は、既存のアプリディレクトリを複製し、対応するエントリーポイントを設定してください。
5. **コンテンツスクリプトのスコープ制限:** デモ用のコンテンツスクリプトはすべての `http`/`https` ページにマッチし（`src/entrypoints/content/index.tsx` の `matches`）、コンテンツスクリプトはコード分割できないため、各ページに Mantine + React のフルバンドル（約 550 kB の JS + 260 kB の CSS）が注入されます。デモとしては問題ありませんが、実際の製品では `matches` を対象サイトに絞り込むか、広いマッチのままマウントを遅延させてください（ユーザー操作時に動的 import する）。広範なホスト権限はストア審査でも追加の精査対象になります。

### ビルドとデプロイ

```bash
pnpm compile && pnpm lint && pnpm build
pnpm test                # vitest: ライフサイクル、ストレージ、および純粋なロジックの不変条件をテストします (happy-dom + fake-browser)
pnpm audit:css           # CSS変数のスコープの安全性を検証します (TailwindやMantineの更新後の実行を推奨)
pnpm audit:ascii         # ビルドされた成果物が純粋なASCII文字列であることを保証します (Chrome拡張機能読み込み時のCJK/UTF-8起因のエラーを回避)
                         # 両監査には `:firefox` バリアントがあり、`pnpm build:firefox` の出力を検査します

pnpm zip                 # Chrome Web Store 向けの zip アーカイブを生成します (AMO向けは `pnpm zip:firefox` を使用)
```

---

## 2. プロジェクトのアーキテクチャ

```text
src/
├── entrypoints/      # WXT エントリーポイント (自動検出) — 軽量なマウント層
│   ├── background.ts
│   ├── popup/        # index.html + main.tsx (options/、sidepanel/、tab/ も同様の構造)
│   └── content/      # ページ内 content script (index.tsx)
├── react-app/        # アプリケーションのコアロジック
│   ├── apps/         # 各エントリーポイントに対応するReactアプリ
│   ├── components/   # 共有UIコンポーネント
│   ├── managers/     # VisualManager (テーマの同期)、Mantine レジストリ
│   ├── hooks/        # 拡張機能固有の Hooks (useExtStorage など)
│   └── styles/       # global.css、Mantine SCSS mixins
├── surface/          # 分離インフラストラクチャ: documentSurface、createShadowSurfaceUi、createSatellite
├── core/             # コンテキスト間の通信: メッセージングおよびRPC
└── constants/        # 名前空間の接頭辞、Z-Index階層、共有デザイントークン
public/               # ビルド出力に直接コピーされる静的アセット
vite-plugins/         # カスタムビルドプラグイン (UTF-8文字列の自動エスケープ処理など)
wxt.config.ts         # WXTおよびViteの設定、Manifest定義、ブラウザターゲットの構成
```

`src/entrypoints/` はWXTによって自動検出される唯一のディレクトリです。それ以外のディレクトリは標準的なアプリケーションコードとして扱われ、`@/` エイリアス経由でインポートされます。WXT固有のAPIは仮想モジュール `#imports` から取得します。各エントリーポイントは、`src/react-app/apps/` から特定のアプリケーションをマウントするための最小限のshimとして機能します。

> **設計上の決定事項:** この構造は、WXTのフラットな自動インポート規則（`hooks/` や `utils/` をソースルートに配置する手法）から意図的に逸脱しています。アプリケーションコードを `react-app/` 以下にカプセル化し、明示的なインポートを強制することで、厳格なモジュール境界を確立しています。WXTの `#imports` 機能自体は、必要な場所で引き続き完全にサポートされています。

---

## 3. コアコンセプト

| Surface の種類 | ファクトリメソッド                         | 主なユースケース                                  | インスタンスの制限   |
| -------------- | ------------------------------------------ | ------------------------------------------------- | -------------------- |
| **Document**   | `documentSurface()` + `renderSurfaceApp()` | ポップアップ、サイドパネル、オプション、独立タブ  | ページごとに 1 つ    |
| **Shadow**     | `createShadowSurfaceUi()`                  | ページ内に注入される大規模かつ高度に隔離されたUI  | フレームごとに 1 つ¹ |
| **Satellite**  | `createSatellite()`                        | 軽量なUIコンポーネント (ツールバー、バッジなど)   | 無制限               |
| **Content**    | 該当なし (デザインパターンを参照)          | ホストページの直接的なDOM操作やスタイリングの適用 | 該当なし             |

¹ `createShadowSurfaceUi` は技術的に複数のインスタンスをサポートしていますが、現在のSatelliteレジストリは単一のホストにバインドされています。

**一般的なガイドライン:**

- **UIの分離:** React DOMのレンダリングは厳密にIsolated World環境内で実行してください。Main Worldは、ホストページのコンテキストを明示的に必要とするUIを持たないロジックのために予約されています。
- **Surface と Content の使い分け:** ホストページにレイアウトの制御を委ねる必要がある場合は、標準のDOM操作 (Content トラック) を使用してください。拡張機能側でテーマとレイアウトを完全に管理する必要がある場合は、分離された Surface を導入してください。

### 環境の抽象化 (`SurfaceEnv`)

ポップアップのドキュメント環境内でのレンダリングであっても、Shadow DOM環境下であっても、マウントポイントの環境的な差異は単一のインターフェース (`surface/defs.ts`) に抽象化され、`MantineRegistry` に提供されます。

```typescript
interface SurfaceEnv {
  kind: 'document' | 'shadow';
  rootElement: HTMLElement; // Mantine 変数のルートおよび data-mantine-* 属性のホスト要素
  portalTarget: HTMLElement; // フローティングレイヤー (Modal, Popover) の注入先ターゲット
  scale: number; // Rem の動的補正値 (16 / ホストの実際のrem基準値)。ドキュメント環境では常に 1。
  colorSchemeStrategy: 'extension' | 'force-light' | 'force-dark';
}
```

**`document.body` の直接操作は避けてください。** DOMへのアクセスは、常に `useSurface()` フックを介して安全に実行してください。

### サテライト (Satellites)

Satellites は、ホストページに注入される軽量かつターゲットを絞ったUIコンポーネントです。ホストとなる Surface が初期化時にReactプロバイダーとグローバルスタイルを一度だけ構築します。その後の各 Satellite は、空の shadow コンテナ、共有された `CSSStyleSheet` への参照、そしてReactポータルのみでレンダリングを完了します。

`createSatellite()` を使用して `SatelliteOutlet` にコンテンツをレンダリングします。アウトレットのマウントのライフサイクルは `renderSurfaceApp` によって自動的に管理されます。

Satellites はデフォルトで `isolateEvents` 機構を備えており、拡張機能内でのユーザーのキーボード操作がホストページのショートカットを意図せずトリガーすることを防ぎます。内部の `MutationObserver` がDOMを監視し、Satelliteの正確な配置を維持します。

- **自動アンマウント:** ホスト要素またはアンカー要素がDOMツリーから削除されると、コンポーネントは即座にアンマウントされます。
- **シームレスな再配置:** アンカー要素がページ上で位置を変更した場合、コンポーネントは自動的に追従して再配置されます。

スタイルは Constructable Stylesheets を通じて共有されます。対象ブラウザがサポートしていない場合は、システムが `<style>` タグの複製モードに安全にフォールバックします。（注：開発モードにおいて、ホストページの厳格なコンテンツセキュリティポリシー (CSP) により、注入された `<link>` 要素がブロックされる場合があります。スタイルの最終確認は、`<style>` タグを安全にインライン化する本番ビルドの成果物で行ってください。）

### テーマ管理

`useVisual()` はテーマ関連のすべてのロジックを統合する主要なフックです。Mantineのネイティブフックを直接使用する代わりに、以下を提供します。

- カラースキームの管理 (`light`、`dark`、または `auto`)。
- テキストの方向制御 (Mantine の `DirectionProvider` を介した `ltr` および `rtl` サポート)。
- プライマリーカラーの動的生成。Mantineのパレット名 (例: `blue`) または任意の16進数カラーコードを渡すことで、完全な10段階のパレットを動的に生成します。

### 状態の同期

すべての Surface 間における状態の同期は、WXTが提供する storage API によってシームレスに管理されます。ポップアップでテーマを変更すると、ページ内に注入されたUIもミリ秒単位でリアルタイムに更新されます。

カスタムのリアクティブな状態を同期する場合は、`useExtStorage` フックを使用して `storage.defineItem` をラップしてください。その際、オブジェクトや配列のフォールバック値（初期値）には、不必要なレンダリングを防ぐために、モジュールレベルの安定した参照を使用してください。

### コンテキスト間の通信

本テンプレートは、コンテキスト間の通信のために、厳密に型付けされた2つのチャネルを提供します。

- **メッセージング (`core/messaging`):** `ProtocolMap` にインターフェースを登録するだけで、送信側および受信側で型安全な `sendMessage` と `onMessage` ユーティリティが利用可能になります。これにより、脆弱な文字列ベースのアクションや手動でのリスナー管理が完全に不要になります。
- **RPC (`core/rpc`):** サービスクラスを一度だけ定義し、バックグラウンドスクリプトで登録すれば、`@webext-core/proxy-service` を介して、任意の Surface からローカル関数のように呼び出すことができます。これは、クロスオリジンのリクエスト、大規模なダウンロード、長時間実行されるタスクなど、バックグラウンドに特化した重い処理に最適なアプローチです。

---

## 4. Shadow DOM の制限事項と対応策

Shadow DOM は優れたカプセル化機能を提供しますが、CSSの継承の特性により、予期せぬ動作を引き起こす場合があります。以下の戦略は、よくある境界事象に対する解決策です。

| 課題                    | 症状                                                     | 解決策                                                                           |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| プロパティの継承        | ホストページのタイポグラフィが拡張機能のUIに影響を与える | `.aie-surface-root` に厳格なタイポグラフィのリセット (Reset) を適用する          |
| `rem` サイズの漏洩      | ホストの `font-size` がUIを不均衡にスケーリングさせる    | `theme.scale = 16 / 実際のrem値` を設定し、ホストの基準値を動的に相殺する        |
| `@property` の衝突      | TailwindのCSS変数がホスト側と競合する                    | 変数を `--tw-` から `--aie-tw-` にリネームする (`postcss.config.cjs` で設定済み) |
| Tailwind `rem` のバグ   | ホストの `rem` の影響でTailwindの余白が崩れる            | `.aie-surface-root` に `calc(x * var(--mantine-scale, 1))` の補正係数を適用する  |
| Modal の `lockScroll`   | Modalを開いた際、背後のホストページがフリーズする        | すべての Modal および Drawer に `lockScroll: false` を設定する                   |
| `lightningcss` の精度   | 巨大な `z-index` 値がコンパイル時に誤って圧縮される      | `Z_INDEX` の定数を有効数字6桁以内に制限する                                      |
| 外部CSSのオーバーライド | ホストの強力なCSSが拡張機能のカプセル化を突破する        | フレームワークの変数を `.aie-surface-root` のスコープ内に厳密に強制する          |

### CSS変数のセキュリティ戦略

すべてのルートレベルのCSS変数は、shadowツリー内の `.aie-surface-root` スコープ内に安全に封じ込められています。これにより、外部の予測不可能な `:root` や `:host` セレクタから物理的に隔離されます。デザイントークンのスコープの安全性を監査するために、定期的に `pnpm audit:css` を実行してください。

**Z-Index 階層:** `src/constants` の `Z_INDEX` 定数として定義され、`global.css` に `--<prefix>-z-*` CSS変数としてミラーリングされます（`src/constants/index.test.ts` のテストが両者の同期を保証します）。
階層の順序: `floatUi < mainUi < modal < popover < notification < max`。

### 厳格な CSP との互換性

ホストページが厳格な Content-Security-Policy（例: `script-src 'self'; style-src 'self'; style-src-attr 'none'`、`unsafe-inline` なし）を設定していても、surface は正常に動作します。コンテンツスクリプトの JS は isolated world で実行され（ページではなく拡張機能自身の CSP に従う）、すべてのスタイルは shadow root 内に配置されます——WXT が注入する `<style>`、Mantine のテーマ変数、satellites の `adoptedStyleSheets`——そのためホストの `style-src`/`script-src` は届きません。ホストを変更する唯一の例外（Mantine がカラースキーム切替時にページの `<head>` に注入する遷移用 `<style>`）は `keepTransitions: true` で無効化済みです。`pnpm build` 後に `test-pages/csp-strict-host.html` で検証してください。

---

## 5. アーキテクチャの原則 (Hard Rules)

1. **`document.body` の使用禁止:** DOMへのすべてのアクセスは `useSurface()` を介して実行してください。
2. **ホストの完全性の保護:** 拡張機能の Modal、Drawer、Portal は、ホストの `document` や `body` のスタイルを絶対に変更してはなりません。
3. **Content UI における Emotion の使用禁止:** `document.head` にスタイルを動的に注入する CSS-in-JS ライブラリは、Shadow Root 環境では致命的な不具合を引き起こします。提供されている CSS Modules と Mantine のネイティブ CSS 変数を使用してください。
4. **副次的なUIへの Satellites の適用:** 小さなコンポーネントを配置するためだけに、完全な Surface インスタンスを初期化することは避けてください。Satellites を介してルーティングを行ってください。
5. **Content トラックのシンプル化:** TailwindのクラスやReactノードを使用して、ホストページのDOMを直接操作しないでください。Vanilla DOM API と独自のプレフィックスを持つCSSクラスを併用してください。
6. **認証ロジックの隔離:** 機密情報を含むUIワークフローは、Main World から厳格に隔離してください。
7. **フローティングコンポーネントの制約:** すべての Popover、Tooltip、Menu コンポーネントは、明示的に `zIndex: Z_INDEX.popover` および `floatingStrategy: 'fixed'` を使用するように設定してください。
8. **名前空間の遵守:** `PROJECT_PREFIX` は `prefix.cjs`（唯一の信頼できる情報源）でのみ変更してください。`src/constants`、`postcss.config.cjs`、CSS監査はそこから派生します。手動ミラーは `global.css` のみであり、`pnpm test` / `pnpm build` がドリフトを防ぎます。

---

## 6. デザインパターン (任意)

高度な実装を構築する際の推奨アプローチを以下に示します。

### 6.1 Content トラックの高度な活用

テキストのハイライトやホストコンテンツの解析を行う場合は、Content Script 内に Vanilla DOM モジュールを実装してください。拡張機能がロジックを制御し、スタイリングの適用はホストページに委ねるアプローチを取ります。

- DOMのマーカーには、安全な `data-aie-*` 属性を使用してください。
- 複雑なインタラクションが必要な場合は、ターゲットノード内に Satellite コンポーネントをマウントしてください。

### 6.2 Main-World へのブリッジ

ホストページが公開しているネイティブの JavaScript API へのアクセスが不可欠な場合にのみ、Main World を利用してください。必要な操作を実行した後、クロスサイトスクリプティングのリスクを軽減するため、`@webext-core/messaging/page` を介してデータを直ちに Isolated World へ返送してください。

### 6.3 その他

- **ビルド時のエンコーディング:** `vite-plugins/to-utf8.ts` は、ビルドされたチャンク内の非ASCII文字を安全なUTF-8エスケープシーケンスに強制変換します。これにより、CJK文字や絵文字を多用したバンドル読み込み時にChromeがスローする "non-UTF-8" エラーを未然に防ぎます。このプラグインはデフォルトで有効になっており、純粋なASCII出力には影響を与えません。
- **環境固有のビルド:** 開発 (dev) と本番 (prod) でロジックを分岐させる場合は、`wxt.config.ts` の `manifest` 関数内で `mode` 変数に基づいた条件分岐を実装してください。
- **カスタム Storage Hooks:** 実装の詳細は `src/react-app/hooks/useExtStorage.ts` を参照してください。

アプリケーション固有の肥大化要因は、設計上意図的に除外されています。カスタムのHTTPクライアント、OAuth認証 (`chrome.identity`)、DOMパーサーなどは、必要に応じて `src/services` や `src/react-app/utils` に追加してください。

### 6.4 マウントポイントの追加

ポップアップ、サイドパネル、オプションページ、およびタブは、事前に `documentSurface()` エンジンに統合されています。新しいインターフェースを追加する場合は、既存のエントリーポイントのテンプレートを複製して設定を行ってください。

---

## 7. 既知の制限事項

- 現在のアーキテクチャでは、単一フレーム内の Satellite レジストリは、単一のホスト Surface インスタンスにのみバインドされます。
- Rem の補正係数は、初期化時に一度だけ計算されます。その後、ホストページがルート要素のフォントサイズを動的に変更した場合、拡張機能のUIは自動的にリサイズされません。
- `MutationObserver` はデフォルトでDOMツリー全体の変更を監視します。DOMの変更が頻繁に発生する複雑なシングルページアプリケーション (SPA) においては、CPU負荷を最適化するために明示的なティアダウン (teardown) ロジックを実装してください。
- 提供されるイベント隔離機能は、現在バブリングフェーズ (bubble phase) でのみ有効です。

---

## 8. 技術スタックと参考リンク

このテンプレートが基盤とする依存関係:

| 依存パッケージ                            | 役割                                                                       | ドキュメント                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| WXT                                       | 拡張機能フレームワーク —— エントリーポイント、manifest 生成、dev/build/zip | [wxt.dev](https://wxt.dev)                                   |
| `@webext-core` (messaging、proxy-service) | 型付きのコンテキスト間メッセージング + バックグラウンド RPC                | [webext-core.aklinker1.io](https://webext-core.aklinker1.io) |
| Mantine                                   | ネイティブ CSS 変数ベースの UI コンポーネントとテーマ                      | [mantine.dev](https://mantine.dev)                           |
| React (`@wxt-dev/module-react` 経由)      | UI ランタイムと WXT React モジュール                                       | [react.dev](https://react.dev)                               |
| Tailwind CSS                              | 名前空間付きユーティリティ CSS (v4、lightningcss)                          | [tailwindcss.com](https://tailwindcss.com)                   |
| TypeScript                                | 言語と型チェック                                                           | [typescriptlang.org](https://www.typescriptlang.org)         |
| Vite (rolldown)                           | WXT がビルドに用いるバンドラー                                             | [vite.dev](https://vite.dev)                                 |
| Vitest                                    | ユニットテスト (happy-dom + fake-browser)                                  | [vitest.dev](https://vitest.dev)                             |

正確なバージョンは `package.json` を参照してください。
