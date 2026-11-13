# Surface 可选接入指南

[English](surface-recipes.md) | [简体中文](surface-recipes.zh-CN.md) | [日本語](surface-recipes.ja.md) | [한국어](surface-recipes.ko.md)

以下能力和示例按需使用，不属于默认入口，也不影响默认外观、注入范围或开发流程。

## 应用主题与方向

在 `src/react-app/theme.ts` 定义字体、命名色板、Mantine virtual color 和组件默认样式。在 `src/react-app/theme-defaults.ts` 设置初始主色偏好；使用品牌色时，将这个初始值设为对应色板名称。已保存的用户偏好优先，不会因为更换默认值而被重置。

合并顺序是：应用主题 → 用户选择的主色 → Surface 隔离配置。命名色从合并后的主题解析；HEX 值生成色板。Surface 最后设置 rem 缩放，以及 Shadow UI 的 Portal 目标、滚动锁定和浮层配置。组件显式 props 仍可覆盖主题默认值，因此注入网页的 UI 不应显式覆盖这些隔离配置。

方向是扩展级偏好，由 `useVisual()` 提供设置、持久化和跨 Surface 同步。方向写入各 Surface 和 Satellite 自有根节点，不修改宿主网页的 `<html>`。独立扩展页面拥有自己的 `<html>`，可以正常设置它。语言与方向的映射由应用决定。

## 动态明暗主题接口

除 `extension`、`force-light`、`force-dark` 策略外，也可以传入一个可订阅的数据源，动态控制单个 Surface 的明暗主题：

```ts
import { createColorSchemeSource } from '@/surface/color-scheme';

const scheme = createColorSchemeSource('light');
// 在现有 createShadowSurfaceUi 或 documentSurface 的 options 中设置：
// colorSchemeStrategy: scheme,

// 应用状态发生变化时，更新同一个实例：
scheme.set('dark');
```

数据源保持实例稳定，不要每次 render 重建；可按 Surface 分别创建，也可以明确共享。已有的外部状态系统可以直接实现 `ColorSchemeSource`：

- `getSnapshot()` 同步返回明确的 `light` 或 `dark`。
- `subscribe(listener)` 订阅变化，并返回清理函数。
- 两个函数引用应稳定，且不能依赖 `this` 绑定。

Provider 卸载或切换数据源时会取消订阅。外部数据源不写入扩展主题偏好；`useVisual().setColorScheme()` 仍修改扩展偏好，但不会覆盖被外部源或强制策略控制的显示结果。这类 Surface 应隐藏主题偏好按钮，或解释按钮实际修改的是扩展偏好。

## 可选配件：跟随宿主明暗主题

```ts
import { followHostColorScheme } from '@/surface/addons/host-scheme';

// 在现有 Shadow Surface 的 options 中设置：
// colorSchemeStrategy: followHostColorScheme,
```

核心没有导入这个配件。仅导入模块不会启动 observer 或事件监听；第一个订阅者出现时启动共享监听，最后一个订阅者退出时清理监听和待执行任务。

配件通过 html/body 背景色叠加估算主题，同时考虑浏览器画布的 color-scheme，并监听根节点属性、系统配色偏好、页面恢复可见和背景过渡。

它是启发式检测：背景图片、覆盖整个视口的子容器，以及仅通过 CSSOM / 替换样式表进行的切换，都可能无法及时或准确识别。宿主提供可靠主题信号时，直接实现自己的 `ColorSchemeSource` 即可，无需修改 Surface 内核。该配件用于宿主网页上的 Shadow UI，不用于扩展自己的独立页面。

真实浏览器验证时，临时在现有 content 入口启用配件，分别测试普通明暗切换、带 CSS transition 的切换和系统媒体查询切换；检查宿主属性未被改写，并确认卸载后监听被释放。happy-dom 单测只验证状态与订阅，不等同于浏览器绘制验证。

## RPC 的前后台边界

Echo 示例分为 `src/core/rpc/echo/contract.ts` 和 `impl.ts`。UI 从 contract 导入 `getEchoService`；后台从 impl 导入 `registerEchoService`。不要在客户端使用的 barrel 文件中重新导出后台实现。

ESLint 配置仅保护模板 RPC 的实现边界，不限制下游业务服务的组织方式。这些 import 规则不是完整的传递依赖分析，也不对业务代码规定体积预算。

## 多入口与 iframe

“帧”指 iframe 子页面，不是动画帧。每个 iframe 有自己的 document 和 content-script 上下文；顶层的输入、选区监听不会自动收到 iframe 内的事件。

推荐按实际需要分工：

- `src/entrypoints/content/index.tsx` 只挂载顶层浮层。
- 需要处理 iframe DOM 时，另建轻量 content 入口，不导入 React/Mantine。
- 仅在需要时启用 `allFrames`、`matchAboutBlank`。它们仍受 URL 匹配、权限和浏览器限制约束，不保证覆盖任意 iframe。
- 如果下游为 UI 入口开启了 allFrames，在 main 开头用 `if (window.self !== window.top) return;` 防止浮层重复出现。
- 跨帧协调使用扩展消息和明确的 frame 目标，不依赖入口加载先后，也不尝试从顶层直接读取跨域 iframe DOM。

下面是使用 `ctx.addEventListener` 的轻量入口示例。代码只放在文档中，不会被 WXT 自动构建或注入。

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

## 异步初始化与清理

使用 WXT 的 context 生命周期，无需另一套框架：

1. 异步初始化前注册失效清理。
2. 每次 await 后检查 `ctx.isInvalid`，再挂载 UI 或启动 observer。
3. `ctx.addEventListener` 随 context 失效自动清理；storage watch、MutationObserver 等资源通过 `ctx.onInvalidated` 显式释放。
4. “先 watch，再读取初始值”仍需 revision 检查，防止迟到的旧读取覆盖新 watch 事件。
5. 请求可使用 `ctx.signal` 取消，但 await 后仍需检查状态。重叠的启动/停止操作还需要独立 generation，不能只检查 context 是否有效。
6. `createShadowSurfaceUi` 在 context 失效后会忽略 `mount()` / `autoMount()`，并在失效时移除 UI（同时停止 `autoMount`）。`await` 它之后仍应像现有入口那样先检查 `ctx.isInvalid`，再启动其他工作；保留现有 `onRemove` 对 React root 的卸载，并处理初始化 promise 的失败。

下面的完整示例展示 storage 初始化、revision 防乱序以及 observer/watch 清理，不包含任何产品逻辑。

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
