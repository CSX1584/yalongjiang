import { Gauge } from '@phosphor-icons/react'

/**
 * 模块占位页：一级导航与生产管理子菜单的未实现模块共用
 */
export default function PlaceholderPage({ title, eyebrow = 'MODULE' }) {
  return (
    <div className="placeholder-page">
      <Gauge size={40} />
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>该模块为演示占位，功能建设中</p>
    </div>
  )
}
