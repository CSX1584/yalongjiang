# 光伏电站 3D 监控组件嵌入说明

这个压缩包提供 `SolarPlantMonitor` React 组件，以及运行它所需的模型、贴图和 EXR。它不包含场景编辑器，也不会接管目标项目的路由或 React 根节点。

## 1. 安装

把 `solar-plant-monitor-embed-0.1.0.tgz` 放到目标项目根目录，然后执行：

```bash
npm install ./solar-plant-monitor-embed-0.1.0.tgz
```

目标项目需要使用 React `19.2.8`、React DOM `19.2.8` 和 Lucide React `1.31.0`。组件会安装 Three.js、React Three Fiber 和 Drei。

## 2. 嵌入页面

```jsx
import {
  DEFAULT_ENVIRONMENT,
  SolarPlantMonitor,
} from 'solar-plant-monitor-embed'

export function SolarPlantPage() {
  return (
    <div style={{ width: '100%', height: 560 }}>
      <SolarPlantMonitor
        deviceStatuses={null}
        environment={DEFAULT_ENVIRONMENT}
      />
    </div>
  )
}
```

外层容器必须有明确高度。`deviceStatuses={null}` 表示不显示模拟设备状态；删除这一行会使用组件内置的模拟状态。

## 3. 使用已有场景数据

如果目标项目已经读取了编辑器导出的场景 JSON，可以把解析后的对象传给 `documents`：

```jsx
<SolarPlantMonitor
  documents={documents}
  deviceStatuses={null}
  environment={DEFAULT_ENVIRONMENT}
/>
```

不传 `documents` 时，组件使用内置默认场景。

## 4. 传入设备状态

当前设备状态键用于定位单块光伏板：

```jsx
import {
  MONITORING_STATUSES,
  SolarPlantMonitor,
  getPvPanelDeviceId,
} from 'solar-plant-monitor-embed'

const deviceStatuses = {
  [getPvPanelDeviceId(sceneInstanceId, componentId, row, column)]:
    MONITORING_STATUSES.WARNING,
}

<SolarPlantMonitor
  documents={documents}
  deviceStatuses={deviceStatuses}
/>
```

## 5. 默认操作

- Hover 光伏子阵、储能子阵或 Grid 时显示设备轮廓。
- 左键点击光伏或储能子阵后，镜头推进并弱化其他实例。
- 聚焦后点击当前子阵之外的区域恢复全景。
- 中键拖动平移，右键拖动旋转，滚轮缩放。

## 6. 常见问题

- 页面空白：先确认外层容器具有非零高度。
- 模型加载失败：确认目标项目由 Vite 构建，并且安装包中的资源没有被手工删除。
- 不需要 EXR：将 `environment` 传为 `null`。
- 需要使用自己的模型：通过 `assetRegistry` 传入六类模型 URL 覆盖默认资源。

完成安装后运行目标项目的生产构建；最终画面和交互效果由用户在目标页面中确认。
