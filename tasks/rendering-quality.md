# 渲染材质调整 · 2026-09-09

基线：`98ad2c4`，标签 `rendering-baseline-20260909`。优化分支：`improve-render-quality`。

- 浅色 GLB：去掉储能箱颜色贴图的自发光用途，区分光伏玻璃、金属支架、涂层风机的金属度和粗糙度，底座改为中性灰。
- 浅色方向光阴影浓度从 1 改为 0.85；原有抗锯齿、mipmap 和最高阴影质量保持开启。
- 没有增加实时 AO、提高纹理分辨率或改用另一套渲染器；本次是材质和阴影浓度调整，不是渲染管线重写。

复现材质处理：在 `app` 执行 `node scripts/tune-station-materials.mjs`。脚本保留 GLB 的几何、UV、动画和纹理二进制数据，并断言输出完整性。运行 `node scripts/check-model-lighting.mjs` 检查投影和旧参数迁移。

验证：构建通过；浏览器近景模型及阴影正常加载，未捕获控制台错误。未进行帧率基准测试，也未新增运行时渲染通道。

对比基线请创建独立工作树：`git worktree add ../0908-rendering-baseline rendering-baseline-20260909`，避免覆盖当前工作。
