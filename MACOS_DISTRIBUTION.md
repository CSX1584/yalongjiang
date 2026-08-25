# macOS 分发包

项目可构建为一个自包含的 macOS App，收件人不需安装 Node.js。

```bash
npm run package:mac
```

生成内容位于 `release/`：

- `雅砻江运维智能体系统-macOS-通用版.zip`：可直接发给用户的压缩包。
- `*.zip.sha256`：用于核对传输后的文件是否完整。
- `雅砻江运维智能体系统.app`：未压缩的本地测试版。

启动器支持 Intel 和 Apple Silicon，最低要求 macOS 11。它使用 macOS 自带的 WebKit 运行项目，不会在用户电脑上启动常驻服务。

注意：当前构建使用临时签名（ad-hoc signing），不是 Apple 开发者公证签名。通过浏览器下载后，macOS 可能在首次启动时要求用户在 Finder 里右键选择“打开”。

## 地图模式

地图模式在 Vite 构建时写入产物，App 打包完成后不能通过修改 `.env` 再切换。

`npm run package:mac` 默认使用 `VITE_MAP_MODE=offline`，因此生成的 App 自带 `public/offline-map/` 下的本地 PMTiles 和样式，不依赖网络或 Mapbox Token。离线模式当前保证：

- 地图可以拖动、缩放、旋转；
- 本地矢量底图可以加载；
- 本地高程包可以构建真实的山地3D起伏，并可在“3D / 平面”之间切换；
- 3D 视角会显示本地渲染的大气与远山雾，切到平面视角时自动淡出；
- 业务站点标记、走廊线和界面交互可以正常使用。

离线包覆盖经度 `100.0–102.1`、纬度 `27.0–30.6`。底图原生数据到缩放级别 12，高程数据到级别 8；界面允许继续放大到 15，更高级别会使用已有数据过缩放，不会产生新的地图或地形细节。地图会限制在离线包覆盖范围内，避免拖到完全没有数据的区域。

当前离线样式没有配置 `glyphs`、`sprite` 或文字/图标图层。离线 3D 使用随包提供的 Terrarium 高程数据，不是在线 Mapbox 实时地形；Mapbox 样式中的完整文字、图标、3D 建筑/模型仍不能视为离线能力。

如果需要构建在线 Mapbox 版本：

```bash
VITE_MAP_MODE=online \
VITE_MAPBOX_ACCESS_TOKEN='pk.********' \
npm run package:mac
```

如果希望“有离线包就离线、没有离线包再在线”，可以使用：

```bash
VITE_MAP_MODE=auto npm run package:mac
```

`VITE_MAPBOX_ACCESS_TOKEN` 仅用于在线模式；真实 Token 应保存在本机未提交的 `.env.local` 或构建环境中，不要写入版本库。
