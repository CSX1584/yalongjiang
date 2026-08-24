import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'

export class ViewportErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="viewport-error" role="alert">
        <TriangleAlert size={28} />
        <strong>三维视口无法启动</strong>
        <p>请确认浏览器已启用 WebGL，并检查显卡或浏览器策略。</p>
        <details>
          <summary>错误详情</summary>
          <code>{this.state.error.message || '未知渲染错误'}</code>
        </details>
      </div>
    )
  }
}

