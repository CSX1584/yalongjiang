import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gauge, Plus } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { COMPOSER_MODES } from './ComposerToolbar'
import { severityKeyOf, TaskCard, ticketPath } from './taskCardUtils'
import { ToggleButton, ToggleButtonGroup } from '@heroui/react'

const GUI_TABS = [
  { key: 'todo', label: '待办' },
  { key: 'done', label: '已处理' },
]

/**
 * GUI 模式 tab 行：待办/已处理 + 最右「+」新建菜单（复用输入框「通用事项」的选项定义）
 * 没有输入框，菜单项点击直接执行动作
 */
export function GuiTabsBar({ activeTab, onTabChange }) {
  const navigate = useNavigate()
  const { requestDefectForm, setInspectionStage } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  const pickMode = (mode) => {
    setMenuOpen(false)
    if (mode.key === 'defect') {
      requestDefectForm()
      // fromWorkbench 标记：顶部导航保持 AI工作台高亮
      navigate('/production/defect', { state: { fromWorkbench: true } })
      return
    }
    if (mode.key === 'report') {
      setInspectionStage('list')
      navigate('/inspection', { state: { fromWorkbench: true } })
      return
    }
    if (mode.key === 'task') {
      navigate('/inspection-task/INS-20260715-001')
    }
  }

  return (
    <div className="gui-tabs">
      <ToggleButtonGroup
        className="gui-tabs__group ops-heroui-toggle-group"
        aria-label="任务状态"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([activeTab])}
        onSelectionChange={(keys) => {
          const next = String([...keys][0] ?? '')
          if (next) onTabChange(next)
        }}
      >
        {GUI_TABS.map((tab) => (
          <ToggleButton
            key={tab.key}
            className={`gui-tabs__tab ops-heroui-toggle ${activeTab === tab.key ? 'is-active' : ''}`}
            id={tab.key}
            variant="ghost"
          >
            {tab.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <span className="composer-mode gui-tabs__add">
        {menuOpen ? (
          <>
            <span className="composer-mode__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <span className="composer-mode__menu composer-mode__menu--below" role="menu">
              {COMPOSER_MODES.map((mode) => (
                <button key={mode.key} type="button" role="menuitem" onClick={() => pickMode(mode)}>
                  {mode.menu}
                </button>
              ))}
            </span>
          </>
        ) : null}
        <button
          className="icon-button"
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="新建"
          title="新建"
        >
          <Plus size={16} />
        </button>
      </span>
    </div>
  )
}

/**
 * GUI 模式 Smart Assistant 面板内容：
 * 待办 = 三张缺陷单卡片；已处理 = 历史视图内容（纯会话 + 历史工单）
 */
export function GuiAssistantPanel({
  activeTab,
  todoTickets,
  doneThreads,
  doneTickets,
  pathname,
  activeChatId,
  chatDockOpen,
  onOpenTicket,
  onOpenThread,
}) {
  if (activeTab === 'done') {
    return (
      <>
        {doneThreads.map((thread) => (
          <button
            className={`task-card ${chatDockOpen && thread.id === activeChatId ? 'is-active' : ''}`}
            key={thread.id}
            type="button"
            onClick={() => onOpenThread(thread)}
          >
            <div className="task-card-title">
              <span className="severity-dot severity-info" aria-hidden="true" />
              <strong>{thread.title}</strong>
            </div>
          </button>
        ))}
        {doneTickets.map((ticket) => (
          <button
            className={`task-card ${pathname === ticketPath(ticket) ? 'is-active' : ''}`}
            key={ticket.id}
            type="button"
            onClick={() => onOpenTicket(ticket)}
          >
            <div className="task-card-title">
              <span className={`severity-dot severity-${severityKeyOf(ticket)}`} aria-hidden="true" />
              <strong>{ticket.title}</strong>
            </div>
          </button>
        ))}
        {!doneThreads.length && !doneTickets.length ? (
          <div className="sidebar-empty"><Gauge size={22} /><span>暂无已处理记录</span></div>
        ) : null}
      </>
    )
  }

  return (
    <>
      {todoTickets.map((ticket) => (
        <TaskCard ticket={ticket} active={pathname === ticketPath(ticket)} key={ticket.id} onClick={() => onOpenTicket(ticket)} />
      ))}
      {!todoTickets.length ? (
        <div className="sidebar-empty"><Gauge size={22} /><span>当前没有待办任务</span></div>
      ) : null}
    </>
  )
}
