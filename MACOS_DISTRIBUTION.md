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
