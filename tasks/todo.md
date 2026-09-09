# 任务清单

- [x] 阶段 1：HeroUI/Tailwind 基座与语义 token 映射
- [x] 阶段 2：全局通用控件迁移
- [x] 阶段 3：浏览器回归、构建与清理
- [x] 检查点：地图/3D 冻结边界与首页内容结构未改变

## 本轮落地记录

- HeroUI v3.2.4 采用选择性样式导入，不启用全局 preflight。
- `--ops-nav-active` 合并到 `--ops-surface-action`；未定义的 `--ops-font-mono` / `--ops-bg-elevated` 引用已收口，无有效消费者的 `--ops-text-device` 已删除。
- 首页恢复换肤前的单条 7 项 KPI 与无标题 Agent DOM 基线，保留统一表面与动效。
- 新增 `--ops-space-1` ~ `--ops-space-5` 间距阶梯；浅色主题的重复裸值改为 canonical token 别名。
- 迁移范围限于通用控件；`DigitalTwin.jsx`、`DroneRouteMap.jsx` 和电站监视器资源未修改。
