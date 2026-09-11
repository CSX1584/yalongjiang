# 项目工作规则

本项目新增或修改页面、功能、组件和视觉样式前，必须先阅读：

1. [memory/FACT.md](memory/FACT.md)
2. [memory/DESIGN_TOKENS.md](memory/DESIGN_TOKENS.md)

## 工作边界

- 以换肤前的首页作为内容结构基线。
- 默认只做视觉语言调整，不改变模块、字段、数量、顺序、数据来源、路由或交互路径。
- 本轮更新目标是全局 token 化、梳理统一设计语言，并合并语义相同的颜色与层级。
- HeroUI 用作 token 语义和组件分类的参考/渐进适配系统，不默认全量替换现有页面。
- 地图模块和 3D 场景模块保持冻结，除非用户明确授权。
- 新需求如果确实需要结构或行为变化，先在实现前明确列出变化点，不要把它伪装成换肤。

## 实施要求

- 每次推送 GitHub 前，必须按照 [memory/FACT.md](memory/FACT.md#推送-github-前保存地图参数) 执行一次地图参数保存，核对 `app/src/data/mapConfig.json` 已落盘，并将配置变更纳入提交后再推送。
- 优先复用现有 React、CSS、token 和组件；新 UI 依赖不作为一次视觉调整的默认全量迁移。
- 新页面和功能沿用 `memory/FACT.md` 的目标，并使用 `memory/DESIGN_TOKENS.md` 的语义 token。
- 若实际引入 HeroUI，先验证 React 19、Tailwind CSS v4、样式导入顺序、全局 reset 冲突和包体影响，再做局部试点。
- 深色和浅色主题保持相同结构、间距、圆角和交互位置；只按主题切换表面色、文字色和地图光照。
- 修改完成后至少运行一次 `npm run build`，并检查 1180px 与 1440px 宽度下的布局。

## 冻结文件

除非用户另行授权，不要修改以下地图、3D 或场景资源边界：

- `app/src/components/DigitalTwin.jsx` 的 Mapbox 生命周期、图层和相机逻辑
- `app/src/components/DroneRouteMap.jsx`
- `app/src/pages/StationPage.jsx` 中的 `SolarPlantMonitor`
- `app/src/preloadSolarPlantAssets.js`
- `app/vendor/solar-plant-monitor-embed`
- 3D 模型、场景 JSON 和相关资源
