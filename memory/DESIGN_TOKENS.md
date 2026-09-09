# 设计 Token：雅砻江运维

本文档是项目的视觉变量单一参考。新增页面和功能先读本文档，再在 `app/src/styles.css` 中复用或补充 token。本文档记录“当前已实现”和“计划统一”两类值，不把计划值误认为已经生效。

## 使用原则

- 以 `4px` 为基础单位；首页模块外框采用已确认的紧凑 `2px` 间距，其余常用阶梯为 `4 / 12 / 16 / 24px`。
- token 表达语义，不在多个组件中重复散落同一个裸值。
- 深色和浅色主题保持相同结构、间距、圆角和交互坐标；主题只重映射颜色、表面和状态色。
- 精确的旧版几何值如果不能无损映射到阶梯，先保留组件值，不能为了“整齐”造成布局变化。
- 地图安全边距、避让偏移和时间轴覆盖值属于地图布局语义，不要擅自当作普通卡片间距改写。

## 本轮 token 化目标

- 全局视觉变量统一进入语义 token，页面组件只消费语义，不直接定义相似裸色。
- 相同用途的颜色、表面和层级合并为一个 canonical token；hover、soft、foreground 和 focus 优先从基础语义派生。
- 以 HeroUI 的语义角色和分类作为参考，但保留项目现有 `--ops-*` 命名，避免第三方 token 反向改变业务语义。
- token 重构必须是可逆的视觉整理，不得改变换肤前的内容结构或地图/3D 冻结边界。

## HeroUI 参考范围

官方 HeroUI v3 的主题系统以 CSS 变量、语义颜色和 BEM 组件类为核心；组件目录按功能类别组织。当前项目已安装并用于语义映射和通用控件的局部适配。

参考文档：[组件目录](https://heroui.com/en/docs/react/components)、[主题](https://heroui.com/en/docs/react/getting-started/theming)、[颜色](https://heroui.com/en/docs/react/getting-started/colors)、[样式](https://heroui.com/en/docs/react/getting-started/styling)。项目已锁定 `@heroui/react@3.2.4`、`@heroui/styles@3.2.4`，通过 Tailwind CSS v4 选择性导入；不启用全量 preflight，避免重置既有业务布局。

### 语义角色映射

| HeroUI 参考角色 | 项目 canonical token | 用途 |
| --- | --- | --- |
| Background | `--ops-bg-canvas` | 页面画布 |
| Surface / Surface secondary | `--ops-surface-main` / `--ops-surface-health` | 面板和次级表面 |
| Surface tertiary | `--ops-surface-diagnostic` / `--ops-surface-inner` | 诊断和内嵌层 |
| Foreground | `--ops-text-primary` | 主文字和主要图标 |
| Foreground muted | `--ops-text-secondary` / `--ops-text-tertiary` | 次级和辅助文字 |
| Separator | `--ops-border` / `--ops-border-soft` | 分隔线和弱边界 |
| Accent | `--ops-accent-primary` | 信息、选中和主要操作 |
| Success | `--ops-success` | 正常状态 |
| Warning | `--ops-warning` | 告警状态 |
| Danger | `--ops-urgent` | 严重状态 |

这是一张语义映射表，不要求把 HeroUI 的变量名直接复制进源码；新增项目 token 前先检查是否已有对应的 `--ops-*`。

### 组件分类参考

HeroUI 分类用于整理项目组件目录，不代表所有组件都要替换：

| 基础类别 | 首批可评估控件 | 项目域组合（不直接替换） |
| --- | --- | --- |
| Foundation | color、surface、type、space、radius、motion | 全局主题和 token |
| Actions / Controls | Button、ButtonGroup、CloseButton、ToggleButton、Switch、Slider | 地图工具、业务操作 |
| Forms / Pickers | Input、Select、Checkbox、DatePicker | 工单和筛选表单 |
| Navigation | Tabs、Breadcrumbs、Pagination | 页面导航和模块切换 |
| Data display | Badge/Chip、Table、Progress、Spinner | KPI、Agent 卡、时间轴 |
| Overlays | Dropdown、Popover、Modal、Drawer、Tooltip | 地图详情和 AI 工作台浮层 |
| Layout / Feedback | Card、Surface、Separator、Alert、Skeleton | 业务面板和加载状态 |

已有 Phosphor 和 Lucide 两套图标，HeroUI 不作为第三套图标来源；图标统一另行决策。

## 当前已实现的全局 Token

来源：`app/src/styles.css` 的 `:root`，当前浅色主题只重映射颜色相关变量。

| 类别 | Token | 当前值 |
| --- | --- | --- |
| 圆角 | `--ops-radius-panel` | `4px` |
| 圆角 | `--ops-radius-control` | `12px` |
| 动效 | `--ops-motion-fast` | `160ms` |
| 动效 | `--ops-motion-standard` | `260ms` |
| 动效 | `--ops-ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| 间距 | `--ops-space-1` ~ `--ops-space-5` | `4 / 2 / 12 / 16 / 24px`（`space-2` 为首页紧凑间距） |
| 壳层尺寸 | `--ops-header-height` | `64px` |
| 壳层尺寸 | `--ops-sidebar-width` | `348px` |
| 壳层尺寸 | `--ops-sidebar-mini-width` | `60px` |
| 壳层尺寸 | `--ops-chat-dock-width` | `480px` |
| 地图外层尺寸 | `--ops-digital-twin-height` | `440px` 弹性基准（`max-width: 1640px` 时为 `420px`，剩余窗口空间自动填充） |

颜色和状态色也已经使用 `--ops-*` 语义变量，包括画布、外壳、主/次级表面、主/次/辅助文字、信息蓝、正常绿、告警黄和严重红。`--ops-nav-active` 已并入 `--ops-surface-action`；孤立的 `--ops-font-mono` 和 `--ops-bg-elevated` 引用也已分别收口到 `--ops-font-data` 与 `--ops-surface-inner`。新增组件应复用这些语义名，不要为单个页面重新命名一套颜色。

总览首页顶部栏与 KPI/Agent 独立卡片共用 `--ops-surface-main`；`--ops-bg-shell` 保留给侧栏和其他外壳结构层。

`--ops-surface-main`、`--ops-surface-health`、`--ops-surface-diagnostic`、`--ops-surface-inner`、`--ops-surface-raised`、`--ops-surface-action` 在深色主题中对应面板、状态分组、诊断区、内嵌区、抬升控件和交互态，亮度与职责均不同，因此暂不为追求数量而合并。仅在深浅主题和使用语义都等价时继续删除 token。

浅色主题中数值完全相同但跨主题职责仍不同的角色使用别名表达：`surface-raised → surface-main`、`workspace-bg → bg-canvas`、`photovoltaic → success`。无有效消费者的 `--ops-text-device` 已删除；这种方式减少裸值和分叉点，同时保留深色主题所需的层级差异。

## HeroUI 当前接入范围

- `Shell.jsx` 设置面板：ToggleButtonGroup（分页、角色、流程、主题、界面模式）和 Button（复位）。
- 跨页面常用操作：表单主/次按钮、巡检报告进入电站、设备诊断、工作台新建会话与智能体切换。
- 壳层图标操作：通知、设置、关闭、任务中心展开/收起和工作台 rail 使用 `Button isIconOnly`。
- 巡检时间范围、设备趋势范围、巡检路线页签和 GUI 待办/已处理页签使用 ToggleButton 语义。
- 地图工具、场站标注、时间轴、KPI/Agent 业务组合和 3D 场景保留原组件；不把 HeroUI 组件强行套入冻结边界。

HeroUI 控件统一通过 `ops-heroui-button` / `ops-heroui-toggle` 兼容层消费项目 token，并显式锁定旧控件高度、圆角和间距，避免迁移造成布局跳动。

## 间距 Token 状态

全局已提供 `--ops-space-1` ~ `--ops-space-5`；首页保留无法无损近似的历史精确值：

| 区域 | 当前值 | 说明 |
| --- | --- | --- |
| 首页外框 | `gap/padding: var(--ops-space-2) = 2px` | 首页模块使用的紧凑间距 |
| KPI 卡片 | `gap: var(--ops-space-2) = 2px; padding: 10px 14px` | 每项为独立卡片，卡间留隙 |
| KPI 数值 | `gap: 6px; margin-top: 4px` | 微间距，暂不强行近似 |
| KPI 辅助行 | `gap: 6px; margin-top: 5px` | 微间距，暂不强行近似 |
| 地图模块 | `flex-basis: var(--ops-digital-twin-height)` | 以 token 为弹性基准填充窗口；地图内部逻辑、相机和数据冻结 |
| 地图工具条 | `height: 64px; padding-inline: 18px` | 工具条坐标需稳定 |
| 时间轴 | `height: 86px; padding: 10px 16px 9px` | 覆盖地图底部 |
| Agent 卡片 | `row gap: var(--ops-space-2) = 2px; internal gap: 4px; padding: 10px 54px 10px 14px` | 每项为独立卡片，右侧图标避让 |
| 对话停靠栏 | `left/bottom outer gap: var(--ops-space-2) = 2px; radius: var(--ops-radius-panel) = 4px` | 与左侧 Rail 和窗口底部保持统一模块间距 |
| 地图浮层 | 主要为 `16px`、`12px` 及 `80/122/102/96px` | 属于地图避让/定位语义；时间轴覆盖自身 `86px` 并与 Agent 卡片保留 `2px` 间距 |

## 间距阶梯与抽取规则

以下阶梯已写入 CSS；后续抽取只在不改变既有几何时使用：

| 目标 Token | 值 | 典型用途 |
| --- | ---: | --- |
| `--ops-space-1` | `4px` | 图标与文字、紧凑内间距 |
| `--ops-space-2` | `2px` | 首页模块间距、紧凑组件间距 |
| `--ops-space-3` | `12px` | 控件内边距、次级分组 |
| `--ops-space-4` | `16px` | 面板内边距、浮层安全边距 |
| `--ops-space-5` | `24px` | 区域之间的明显留白 |

抽取顺序应是“先复用重复且不改变几何的值，再处理 5/6/10/14/18px 等历史精确值”。间距 token 化本身不得改变首页的内容结构。

## 地图覆盖层配方

地图是内容背景，工具条、光照预设、图层菜单、详情卡和时间轴是覆盖层。覆盖层可使用毛玻璃，但必须提供半透明底色作为降级；不要修改 Mapbox/3D 内部生命周期、图层、相机或数据。

- 工具条：约 `64px` 高，水平内边距 `18px`，使用单层半透明表面和模糊。
- 浮层常用安全边距：`16px`。
- 时间轴：约 `86px` 高，覆盖地图底部，不改变地图主体数据和交互。

## 新组件检查

- 是否先复用了现有语义 token？
- 是否把结构变化误写成视觉变化？
- 深色/浅色下间距和交互坐标是否一致？
- 是否触碰地图/3D 冻结边界？
- 是否留下了只为单个组件重复使用的裸色、裸间距或裸圆角？

## 对话组件约定

- `AgentConversation` 是全局对话渲染基线；其 `AgentConversationMessage`、`AgentConversationSuggestions`、`AgentConversationComposer` 子组件负责统一消息行、建议胶囊和输入框的视觉与键盘行为。
- 首页停靠栏、全屏 AI 工作台和巡检任务可以保留各自的页面外壳、上下文卡片与数据适配，但不得另写一套消息气泡或 composer 样式。
- 建议选择行为由页面回调决定：需要保持原路径时，全屏聊天页可立即发送，任务页和停靠栏可先填入草稿；这不改变共享渲染器。
