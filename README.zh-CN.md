# aie-wxt-mantine-surface-template

> 可选主题配件、RPC 边界、多入口 / iframe 与生命周期清理示例：[Surface 接入指南](docs/surface-recipes.zh-CN.md)。

[English](./README.md) | **简体中文** | [日本語](./README.ja.md) | [한국어](./README.ko.md)

[![Use this template](https://img.shields.io/badge/Use_this_template-2ea44f?style=flat&logo=github&logoColor=white)](https://github.com/AIEPhoenix/aie-wxt-mantine-surface-template/generate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/AIEPhoenix/aie-wxt-mantine-surface-template)
![WXT](https://img.shields.io/badge/WXT-0.21-67D55E)
![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

一款适用于构建浏览器扩展用户界面的工业级、生产就绪型脚手架。实现“一次编写，多端运行”，确保代码在弹出窗口（Popup）、侧边栏（Side Panel）、选项页（Options）、独立标签页以及注入宿主页面的 Shadow DOM 中保持高度一致的渲染表现与交互逻辑。

本模板提供绝对的 CSS 隔离保障：扩展样式不会污染宿主页面，同时宿主页面的全局样式也无法干扰扩展的正常显示。

**技术栈：** WXT 0.21、`@webext-core`（消息通信与 RPC 服务）、Mantine 9.3（原生 CSS 变量，完全移除 Emotion 依赖）、Tailwind 4（严格的命名空间隔离）以及 CSS Modules。

## 为什么选择这个模板？

- **UI 只写一次，随处挂载** —— 同一套组件树即可渲染到弹出窗口、侧边栏、选项页、独立标签页，或注入任意网页。
- **真正的 shadow-DOM 隔离，而非奢望** —— 已知的样式穿透向量全部处理到位，并由 `pnpm audit:css` 守护锁定。
- **Chrome 真的能加载的构建产物** —— 为 Vite 8 / rolldown 路径提供 ASCII 输出插件，由 `pnpm audit:ascii` 守护（wxt#353）。
- **基于原生 CSS 变量的 Mantine v9** —— 无 Emotion 运行时；配色方案、文字方向、主色在所有 surface 间自动同步。
- **类型完备、测试齐全、文档完善** —— 开箱即带 TypeScript、vitest 单元测试与多语言文档。

> [!NOTE]
> 本项目定位为底层基础模板，而非臃肿的业务框架。`src/` 目录下的核心代码旨在解决扩展开发中最棘手的环境隔离与通信问题。至于鉴权流程、HTTP/SSE 客户端以及复杂的多环境构建等业务逻辑，均被有意剥离。如需了解相关业务代码的最佳实践，请参阅 [设计模式](#6-进阶设计模式可选) 章节。

---

## 1. 快速开始

需要 Node.js 22.12+ 和 pnpm 10.7.1。WXT 0.21 使用 Vite 8，并显式依赖 `web-ext` 以自动启动浏览器。生成的 TypeScript 配置保持启用 WXT 的严格检查。

Content 入口使用 `cssInjectionMode: 'manual'`，将 `virtual:surface-css` 传给 `createShadowSurfaceUi`。构建插件把入口完整的处理后 CSS（含 CSS Modules）嵌入脚本，避免请求 `chrome-extension://` 样式资源。继续使用普通 CSS import，无需另行维护组件样式列表。WXT 在开发模式下也会分别构建各个 content 入口。插件把输出的样式表移到 `surface-css/<入口>.css`，仅供审计：不会加载到宿主页面，`pnpm zip` 也不会把它打进安装包。未导入 `virtual:surface-css` 的 content script 仍使用 WXT 常规的 CSS 注入。运行 `pnpm audit:surface` 或 `pnpm audit:surface:firefox` 检查内联样式与该文件一致。文档界面仍使用常规样式表加载。

```bash
pnpm install
pnpm dev                 # Chrome：启动已加载该扩展的开发版浏览器
pnpm dev:firefox         # Firefox
```

如需测试注入页面的 UI，请用 `python3 -m http.server -d test-pages 8787` 启动本地测试宿主页，然后打开 `http://localhost:8787/tw3-host.html`。

### 个性化配置

1. **设定命名空间：** `PROJECT_PREFIX` 的唯一真实来源（single source of truth）位于仓库根目录的 **`prefix.cjs`**。只需修改这一行，`src/constants`、`postcss.config.cjs` 及 `scripts/audit-css-vars.mjs` 都会自动跟随。唯一需要手动同步的是 `global.css`（CSS 无法 import 该常量）——请同步修改其中的 `.aie-surface-root` 选择器与 `--aie-z-*` 变量。若遗漏该镜像会被响亮拦下：`pnpm test` 会失败，`pnpm dev` / `pnpm build` 会通过 `check-prefix-sync` Vite 插件发出警告或直接构建失败。此前缀为 CSS 变量及核心容器类添加命名空间，从根本上杜绝与宿主页面的样式冲突。
2. **配置 Manifest：** 在 `wxt.config.ts` 的 `manifest` 函数中调整 `name` 与 `permissions`。请遵循 Manifest V3（MV3）标准编写，WXT 会在构建时自动处理针对 Firefox 的降级转换。
3. **固定扩展 ID（可选）：** 复制 `.env.example` 为 `.env` 文件，并设定 `WXT_EXTENSION_KEY`。此举可通过环境变量安全注入 Manifest 的 `key`，避免硬编码。仅以 `WXT_` 或 `VITE_` 开头的环境变量会被打包入构建产物。请始终将敏感信息留存于 `.env` 中，切勿提交至版本库。
4. **添加 UI 界面：** `src/entrypoints/` 目录下的每个入口文件均负责挂载 `src/react-app/apps/` 中的一个 React 应用。若需新增界面，只需复制现有应用目录并配置对应的入口文件即可。
5. **收窄 Content Script 作用域：** 演示用 content script 会匹配所有 `http`/`https` 页面（见 `src/entrypoints/content/index.tsx` 的 `matches`），而 content script 无法代码分割，因此每个页面都会被注入完整的 Mantine + React 产物（约 800 kB JS，已包含 CSS）。作为演示没有问题；实际产品应将 `matches` 收窄到真正的目标站点，或保持宽匹配但延迟挂载（用户操作时再动态 import UI）。过宽的宿主权限也会在应用商店审核中招致额外审查。

### 构建与发布

```bash
pnpm compile && pnpm lint && pnpm build
pnpm test                # vitest：测试生命周期、存储以及纯逻辑断言（基于 happy-dom 与 fake-browser）
pnpm audit:css           # 验证 CSS 变量的作用域安全性（建议在升级 Tailwind 或 Mantine 后执行）
pnpm audit:ascii         # 确保构建产物为纯 ASCII 字符（绕过 Chrome 在加载扩展时因 CJK/UTF-8 字符导致的解析错误）
pnpm audit:surface       # 确认每个 surface content script 都内嵌了完整 CSS（不经 manifest 注入，也不作为 web-accessible 样式表暴露）
                         # 三个审计均提供 `:firefox` 变体，用于检查 `pnpm build:firefox` 的产物

pnpm zip                 # 打包生成适用于 Chrome Web Store 的 zip 压缩包（`pnpm zip:firefox` 适用于 AMO）
```

---

## 2. 项目架构

```text
src/
├── entrypoints/      # WXT 入口文件（自动扫描）—— 轻量级的挂载层
│   ├── background.ts
│   ├── popup/        # index.html + main.tsx（options/、sidepanel/、tab/ 结构相同）
│   └── content/      # 页面注入脚本 content script（index.tsx）
├── react-app/        # 应用核心业务逻辑
│   ├── apps/         # 各入口对应的独立 React 应用
│   ├── components/   # 共享 UI 组件库
│   ├── managers/     # VisualManager（主题同步管理）、Mantine 注册表
│   ├── hooks/        # 扩展专属 Hooks（如 useExtStorage 等）
│   └── styles/       # 全局样式 global.css、Mantine SCSS mixins
├── surface/          # 核心隔离机制：documentSurface、createShadowSurfaceUi、createSatellite
├── core/             # 跨上下文通信通道：messaging 与 RPC 服务
└── constants/        # 命名空间前缀、Z-Index 层级定义以及共享 Token
public/               # 静态资源目录（构建时原样复制）
vite-plugins/         # 自定义构建插件（如 UTF-8 字符转义处理）
wxt.config.ts         # WXT 与 Vite 配置文件、Manifest 定义及浏览器目标设定
```

`src/entrypoints/` 是 WXT 唯一会自动扫描的目录。除此之外的模块均作为标准的应用代码，统一通过 `@/` 别名进行导入；而 WXT 提供的扩展 API 则通过虚拟模块 `#imports` 引入。所有入口文件仅作为极简的 shim，负责从 `src/react-app/apps/` 挂载对应的应用。

> **架构决策说明：** 此设计刻意摒弃了 WXT 默认的扁平化自动导入约定（即在源码根目录放置 `hooks/` 和 `utils/`）。通过将应用代码内聚于 `react-app/` 目录下并强制要求显式导入，我们确立了严谨的模块边界。WXT 的 `#imports` 功能在需要时依然能够完美兼容。

---

## 3. 核心概念

| 界面类型      | 构建函数                                   | 适用场景                                         | 实例限制       |
| ------------- | ------------------------------------------ | ------------------------------------------------ | -------------- |
| **Document**  | `documentSurface()` + `renderSurfaceApp()` | 弹出窗口、侧边栏、选项页、独立标签页             | 每页面 1 个    |
| **Shadow**    | `createShadowSurfaceUi()`                  | 注入宿主页面的重型且高度隔离的 UI                | 每 Frame 1 个¹ |
| **Satellite** | `createSatellite()`                        | 注入宿主页面的轻量级组件（如工具栏、状态角标等） | 无限制         |
| **Content**   | 无（请参阅“设计模式”）                     | 直接操作或修改宿主页面的原生 DOM 与样式          | 无限制         |

¹ `createShadowSurfaceUi` 在技术底层支持多实例，但当前的 Satellite 注册表设计仅绑定于单一宿主。

**通用准则：**

- **UI 渲染须隔离：** 始终在隔离环境（Isolated World）中渲染 React DOM。主环境（Main World）应严格保留给需要访问宿主页面原生 JavaScript 上下文的无界面逻辑。
- **Surface 与 Content 轨道的选择：** 若界面的排版与布局必须融入宿主页面流，请使用标准的 DOM 操作（即 Content 轨道）；若扩展需完全掌控 UI 的主题与布局，请务必使用独立的 Surface 进行隔离。

### 统一环境抽象（`SurfaceEnv`）

无论是运行于独立的 Document 环境还是嵌入式的 Shadow DOM，挂载点的底层差异均被抽象为统一的接口规范（`surface/defs.ts`），并交由 `MantineRegistry` 统一处理：

```typescript
interface SurfaceEnv {
  kind: 'document' | 'shadow';
  rootElement: HTMLElement; // 承载 Mantine 变量与 data-mantine-* 属性的宿主节点
  portalTarget: HTMLElement; // 浮动层（如 Modal、Popover）的挂载目标节点
  scale: number; // Rem 动态补偿系数（16 / 宿主实际的 rem 基准值），Document 环境下恒定为 1。
  colorSchemeStrategy: 'extension' | 'force-light' | 'force-dark' | ColorSchemeSource;
  shadowRoot?: ShadowRoot; // 仅 Shadow Surface 提供
}

// 为该 Surface 提供已解析配色方案的外部数据源（参见 Surface 接入指南）
interface ColorSchemeSource {
  getSnapshot: () => 'light' | 'dark';
  subscribe: (listener: () => void) => () => void;
}
```

**严禁直接操作 `document.body`。** 所有的环境交互必须通过 `useSurface()` Hook 进行。

### 卫星组件（Satellites）

Satellite 是一种高度聚焦、极度轻量的宿主页面注入组件。宿主 Surface 仅在初始化时加载一次厚重的 React Providers 与全局样式，其后创建的每一个 Satellite 仅需分配一个空的 Shadow 容器、共享的 `CSSStyleSheet` 引用以及一个 React Portal 即可完成渲染。

开发者可通过 `createSatellite()` 将组件映射至 `SatelliteOutlet` 中。Outlet 的实际挂载生命周期由 `renderSurfaceApp` 自动托管。

Satellites 内置 `isolateEvents` 机制，确保用户在扩展 UI 内的键盘交互操作不会意外触发宿主页面的快捷键。Mantine 的焦点陷阱与焦点归还在这层隔离下依然有效（参见[键盘隔离与焦点](#键盘隔离与焦点)）。内部通过 `MutationObserver` 监听 DOM 树，以维持 Satellite 的精准定位：

- **自动卸载：** 当宿主元素或锚点从 DOM 树中被移除时，组件将瞬间卸载。
- **无缝重定位：** 若锚点在页面文档流中发生位置偏移，组件将自动跟随并重新对齐。多个 Satellite 可以共用同一锚点与插入位置。

组件样式通过 Constructable Stylesheets 在各 Shadow Root 间共享：静态 CSS 只解析一次，宿主 surface 和所有 satellite 采用同一个样式表；主题变化时只重新解析 Mantine 那段很小的主题变量样式。若目标浏览器暂不支持，系统将降级为 `<style>` 标签克隆模式。开发和生产构建都会把 CSS 内嵌进 content script，两种模式下都不会去请求样式表。

### 主题管理

`useVisual()` 是处理所有主题相关逻辑的统一 Hook，请避免直接调用 Mantine 的底层 Hooks。该 Hook 封装了以下功能：

- 颜色模式切换（`light`、`dark` 或 `auto`）。
- 文本排版方向（通过 Surface 自有方向 Context 和根节点属性提供 `ltr` 与 `rtl` 支持，不修改宿主方向）。
- 主题色选择：命名色板（包括自定义色和 virtual color）从应用主题中解析；HEX 值生成 10 阶调色板。

### 状态同步

各 Surface 之间的状态同步依赖于 WXT 提供的 Storage API，表现出极高的可靠性。在弹出窗口中切换主题，页面内注入的 UI 将获得毫秒级的实时响应。每个 Surface 在订阅之后还会补读一次偏好，启动期间发生的变更不会丢失。

若需同步自定义的响应式状态，请使用 `useExtStorage` 包装跨实例的 `storage.defineItem` 调用。请注意：配置对象或数组的后备默认值（Fallback）必须采用稳定的模块级引用，以避免不必要的渲染触发。写入采用乐观更新：值会同步生效（受控输入框的光标不会跳动），写入完成后再与 storage 对账。

### 上下文通信

本模板提供两条具备严格类型推导的跨上下文通信通道：

- **消息传递（Messaging，基于 `core/messaging`）：** 在 `ProtocolMap` 中注册通信接口后，即可在发送与接收端获取完全类型安全的 `sendMessage` 与 `onMessage` 方法。彻底淘汰脆弱的字符串行为约束与冗长的事件监听代码。
- **远程过程调用（RPC，基于 `core/rpc`）：** 客户端从 `core/rpc/echo/contract.ts` 导入接口，后台从 `impl.ts` 导入实现并完成注册，即可通过 `@webext-core/proxy-service` 在任意 Surface 中像调用本地函数一样发起请求。此通道是执行跨域 Fetch、大文件处理及长周期任务的最佳实践。

---

## 4. Shadow DOM 局限与应对策略

尽管 Shadow DOM 提供了卓越的隔离能力，但 CSS 的部分继承特性仍可能带来非预期的影响。以下为常见边界问题的应对方案：

| 异常现象                | 临床表现                                                        | 解决方案                                                                         |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 属性穿透继承            | 宿主页面的字体设定影响了扩展 UI                                 | 在 `.aie-surface-root` 容器层执行严格的排版重置（Reset）                         |
| `rem` 基准泄漏          | 宿主异常的 `font-size` 导致扩展 UI 比例失调                     | 设定 `theme.scale = 16 / 宿主实际 rem 值` 进行逆向动态补偿                       |
| `@property` 冲突        | Tailwind CSS 变量与宿主页面定义的变量重名                       | 在 `postcss.config.cjs` 中将 `--tw-` 统一转换为 `--aie-tw-` 前缀                 |
| Tailwind `rem` 适配     | Tailwind 的间距计算因宿主 `rem` 突变而失效                      | 在 `.aie-surface-root` 容器强行应用 `calc(x * var(--mantine-scale, 1))` 修正系数 |
| Modal `lockScroll` 失效 | 开启 Modal 时意外冻结了底层的宿主页面                           | 在所有的 Modal 及 Drawer 组件上强制配置 `lockScroll: false`                      |
| `lightningcss` 精度缺陷 | 超大数值的 `z-index` 在编译阶段被异常折叠压缩                   | 确保 `Z_INDEX` 常量的有效数字严格控制在 6 位以内                                 |
| 外部文档样式高优覆盖    | 宿主页面的高权重 CSS 强行覆盖了扩展样式                         | 将 UI 框架的 CSS 变量严格约束在 `.aie-surface-root` 作用域内                     |
| 按键隔离下的焦点管理    | Modal / Drawer 的焦点陷阱不响应 Tab，关闭后焦点无法回到触发元素 | 所有 Surface 与 Satellite 均已接入 `bridgeFocus`（`surface/focus-bridge.ts`）    |

### CSS 变量安全策略

所有根级别的 CSS 变量均被安全地封锁于 Shadow 树内部的 `.aie-surface-root` 作用域下，从而从物理层面隔绝了外部充满不确定性的 `:root` 与 `:host` 选择器。建议定期执行 `pnpm audit:css` 以审计设计令牌（Design Tokens）的作用域安全性。

**Z-Index 层级规范：** 以 `Z_INDEX` 常量定义于 `src/constants`，并在 `global.css` 中镜像为 `--<prefix>-z-*` CSS 变量（`src/constants/index.test.ts` 中的测试确保二者同步）。
层级秩序为：`floatUi < mainUi < modal < popover < notification < max`。

### 键盘隔离与焦点

Surface 与 Satellite 会在各自的 shadow root 上拦截 `keydown` / `keyup` / `keypress`，避免触发宿主页面的快捷键。但 Mantine 在 `document` 上管理焦点：`useFocusTrap` 与 `useFocusReturn` 在那里监听 `keydown` 并读取 `document.activeElement`，而在 shadow 树之外，后者只会返回 shadow 宿主元素。`bridgeFocus(shadowRoot, { relayTab })`（`surface/focus-bridge.ts`）在内容脚本所在的 isolated world 内补上这两处缺口：它包装该 world 自身 `document` 对象的 `addEventListener` / `removeEventListener` 并覆盖其 `activeElement`，把每次 Tab `keydown` 的副本转交给该 world 的 `document` keydown 监听器，并让 `document.activeElement` 解析到已在桥接中登记的 shadow root 内部。这样 Modal / Drawer 的焦点陷阱可以正常工作，关闭后焦点回到触发元素；宿主页面所在的 world（它的 `document`、监听器与 `activeElement`）不受影响，依然收不到任何按键。

`createShadowSurfaceUi` 与 `createSatellite` 已自动调用它。如果自行创建 shadow root，请在其中的 UI 挂载之前对它调用 `bridgeFocus`（若该 root 拦截了 `keydown`，传入 `relayTab: true`）。限制见[已知局限性](#7-已知局限性)。

### 严格 CSP 兼容性

即使宿主页设置了严格的 Content-Security-Policy（如 `script-src 'self'; style-src 'self'; style-src-attr 'none'`、无 `unsafe-inline`），surface 仍能正常工作。内容脚本 JS 运行在 isolated world（受扩展自身 CSP 约束，而非页面 CSP），所有样式都落在 shadow root 内部——共享的 adopted 样式表、WXT 的 `:host` 重置和 Mantine 的主题变量——宿主的 `style-src`/`script-src` 触及不到。宿主 `<head>` 不会被添加任何内容。`@property` 规则在 shadow root 内不生效，因此构建时会从 surface CSS 中去掉这些规则，改用 Tailwind 自带的逐元素兜底来设置这些变量；代价是带类型的 `--tw-*` 值（如渐变色标）在那里无法参与过渡插值。Mantine 切换配色方案时注入的过渡 `<style>` 已通过 `keepTransitions: true` 关闭。`pnpm build` 后用 `test-pages/csp-strict-host.html` 验证。

---

## 5. 架构红线准则

1. **禁用 `document.body`：** 所有 DOM 访问与操作均须通过 `useSurface()` 代理。
2. **保护宿主完整性：** 扩展的 Modal、Drawer 及 Portal 组件绝不允许直接修改宿主 `document` 或 `body` 的任何样式。
3. **内容 UI 禁用 Emotion：** 依赖向 `document.head` 动态注入 `<style>` 标签的 CSS-in-JS 方案在 Shadow Root 中将遭遇灾难性失败。请严格使用本项目配置的 CSS Modules 及 Mantine 原生 CSS 变量。
4. **合理使用 Satellites：** 避免为单一的微小交互（如注入一个按钮）启动完整的 Surface 实例，请统一通过 Satellite 进行轻量级路由分发。
5. **精简 Content 轨道逻辑：** 严禁使用 Tailwind 类名或 React 节点执行粗暴的宿主 DOM 篡改。请坚持使用 Vanilla DOM API 配合包含专属前缀的 CSS 类名。
6. **鉴权逻辑隔离：** 涉及安全凭证流转的 UI 交互必须彻底与 Main World 隔离。
7. **严格约束浮动组件：** 所有的 Popover、Tooltip 及 Menu 组件必须显式声明 `zIndex: Z_INDEX.popover` 与 `floatingStrategy: 'fixed'`。
8. **捍卫命名空间：** 仅在 `prefix.cjs`（唯一真实来源）中修改 `PROJECT_PREFIX`；`src/constants`、`postcss.config.cjs` 及 CSS 审计脚本均派生自它。唯有 `global.css` 是手动镜像——且 `pnpm test` / `pnpm build` 会守卫其不漂移。

---

## 6. 进阶设计模式（可选）

以下模式阐述了复杂业务场景下的标准实现路径。

### 6.1 Content 轨道的高级运用

若业务需求涉及文本高亮或宿主 DOM 内容解析，应在 Content Script 中封装 Vanilla DOM 模块。遵循“控制权归扩展，渲染权归宿主”的原则，由宿主页面接管排版流。

- 推荐使用 `data-aie-*` 属性作为安全的 DOM 交互锚点。
- 当涉及复杂交互链路时，应在目标 DOM 节点内部挂载 Satellite 组件。

### 6.2 主环境（Main-World）桥接机制

仅在必须调用宿主页面暴露的原生 JS API 时，方可切入 Main World。执行完毕后，必须立即通过 `@webext-core/messaging/page` 将结果数据回传至隔离环境（Isolated World），以防范跨站脚本攻击风险。

### 6.3 工程化杂项

- **构建编码安全：** `vite-plugins/to-utf8.ts` 插件在构建阶段强制将 Chunk 内的非 ASCII 字符转换为安全的转义序列。此举有效预防了 Chrome 在加载含有大量 CJK 字符或 Emoji 的扩展时抛出的 "non-UTF-8" 解析崩溃。该插件默认启用，且不对纯 ASCII 产物产生任何副作用。
- **多环境构建隔离：** 若需区分开发（Dev）与生产（Prod）环境逻辑，请在 `wxt.config.ts` 的 `manifest` 函数中依据 `mode` 变量进行条件分支处理。
- **自定义 Storage Hooks：** 具体实现与约束请参阅 `src/react-app/hooks/useExtStorage.ts`。

业务层面的冗余设计已被本框架刻意剔除。开发者可根据实际业务诉求，在 `src/services` 或 `src/react-app/utils` 目录下自行引入 HTTP 客户端、OAuth 鉴权（如 `chrome.identity`）或复杂的 DOM 选择器解析引擎。

### 6.4 挂载点的扩展

弹出窗口、侧边栏、选项页以及独立标签页均已预先接入 `documentSurface()` 引擎。若需扩充新的界面入口，仅需复制现有的 Entrypoint 模板并调整绑定关系即可。

---

## 7. 已知局限性

- 当前架构下，单个 Frame 内的 Satellite 注册表仅支持绑定至唯一的宿主 Surface 实例。
- Rem 补偿系数在注入生命周期内仅计算一次。若宿主页面在运行时动态修改其根节点的字体尺寸，扩展 UI 不会自动响应其缩放重绘。
- `MutationObserver` 默认监听整棵 DOM 树的变更事件。在 DOM 频繁突变的重型单页面应用（SPA）中，建议开发者编写显式的资源销毁（Teardown）逻辑，以优化 CPU 性能开销。
- 本框架提供的事件隔离机制目前仅在事件的冒泡阶段（Bubble Phase）生效。
- 焦点桥接只转发 Tab（其余按键保持完全隔离）。`document` 监听器收到的是事件副本（`isTrusted` 为 `false`，`target` 是一个私有元素）；捕获阶段的 `document` 监听器，以及在首个负责转发的 shadow root 接入桥接之前注册的 keydown 监听器，不会被镜像。内容脚本 world 中的所有代码读到的 `document.activeElement` 都会解析到 shadow root 内部。
- Satellite 的浮层（Popover、Tooltip、Menu、Select/Combobox 下拉）渲染在宿主 Surface 中，与触发元素分属不同的 shadow root，两者之间基于 ID 的 ARIA 关联（`aria-controls`、`aria-labelledby`、`aria-describedby`、`aria-activedescendant`）无法解析：读屏软件读不到浮层的名称和描述，Select 也不会播报当前选项。需要这些关联的交互（尤其是 Select/Combobox）请放在宿主 Surface 中，而不是 Satellite 中。

---

## 8. 技术栈与参考

本模板所依赖的基础骨架：

| 依赖                                       | 作用                                         | 文档                                                         |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------ |
| WXT                                        | 扩展框架——入口、manifest 生成、dev/build/zip | [wxt.dev](https://wxt.dev)                                   |
| `@webext-core`（messaging、proxy-service） | 类型安全的跨上下文消息 + 后台 RPC            | [webext-core.aklinker1.io](https://webext-core.aklinker1.io) |
| Mantine                                    | 基于原生 CSS 变量的 UI 组件与主题            | [mantine.dev](https://mantine.dev)                           |
| React（经 `@wxt-dev/module-react`）        | UI 运行时与 WXT React 模块                   | [react.dev](https://react.dev)                               |
| Tailwind CSS                               | 带命名空间的工具类 CSS（v4、lightningcss）   | [tailwindcss.com](https://tailwindcss.com)                   |
| TypeScript                                 | 语言与类型检查                               | [typescriptlang.org](https://www.typescriptlang.org)         |
| Vite（rolldown）                           | WXT 构建所基于的打包器                       | [vite.dev](https://vite.dev)                                 |
| Vitest                                     | 单元测试（happy-dom + fake-browser）         | [vitest.dev](https://vitest.dev)                             |

精确版本号以 `package.json` 为准。
