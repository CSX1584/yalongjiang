import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  ClipboardText as ClipboardList,
  CloudSun,
  Command,
  ChartBar as FileChartColumn,
  Gauge,
  Question as HelpCircle,
  List as Menu,
  Plus,
  ArrowCounterClockwise as RotateCcw,
  MagnifyingGlass as Search,
  Gear as Settings,
  ShieldCheck,
  Sparkle as Sparkles,
  User as UserRound,
  Wind,
  X,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { flowSteps, roles, stations } from '../data/demoData'
import CockpitPage from '../pages/CockpitPage'

const roleList = Array.isArray(roles) ? roles : Object.values(roles || {})

function Clock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time className="top-clock" dateTime={time.toISOString()}>
      {time.toLocaleTimeString('zh-CN', { hour12: false })}
      <span> CST</span>
    </time>
  )
}

function TopBar({ onOpenSidebar }) {
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    role,
    setRole,
    taskGrouping,
    setTaskGrouping,
    resetDemo,
    showToast,
  } = useApp()
  const activeRole = roleList.find((item) => item.id === role) || roleList[0]

  const handleReset = () => {
    resetDemo?.()
    setSettingsOpen(false)
    showToast?.('演示数据已复位', 'success')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button sidebar-open" type="button" onClick={onOpenSidebar} title="展开任务中心">
          <Menu size={18} />
        </button>
        <button className="brand-lockup" type="button" onClick={() => navigate('/')}>
          <span className="brand-mark" aria-hidden="true"><Command size={22} /></span>
          <span className="brand-copy">
            <strong>POWERGRID.OS</strong>
            <span>雅砻江运维智能体系统</span>
          </span>
        </button>
      </div>

      <div className="topbar-status" aria-label="场站环境状态">
        <span><CloudSun size={14} /> 晴 24.8°C</span>
        <span><Wind size={14} /> 3.2 m/s</span>
        <span><ShieldCheck size={14} /> 4 站在运</span>
      </div>

      <div className="topbar-actions">
        <Clock />
        <button className="icon-button" type="button" title="全局搜索" onClick={() => showToast?.('搜索可在左侧任务中心中使用')}>
          <Search size={17} />
        </button>
        <button className="icon-button has-badge" type="button" title="通知" onClick={() => showToast?.('3 条运维事件待关注', 'warning')}>
          <Bell size={17} /><span className="notification-badge">3</span>
        </button>
        <button className="role-chip" type="button" onClick={() => setSettingsOpen((open) => !open)}>
          <UserRound size={15} />
          <span>{activeRole?.name || '技术负责人'}</span>
        </button>
        <button className={`icon-button ${settingsOpen ? 'is-active' : ''}`} type="button" title="系统设置" onClick={() => setSettingsOpen((open) => !open)}>
          <Settings size={18} />
        </button>
        <button className="icon-button" type="button" title="帮助" onClick={() => showToast?.('当前为运维演示环境')}>
          <HelpCircle size={17} />
        </button>
      </div>

      {settingsOpen ? (
        <div className="settings-panel" role="dialog" aria-label="系统设置">
          <div className="settings-heading">
            <div><span className="eyebrow">WORKSPACE</span><h2>演示控制</h2></div>
            <button className="icon-button" type="button" title="关闭" onClick={() => setSettingsOpen(false)}><X size={16} /></button>
          </div>
          <section className="settings-section">
            <span className="settings-label">当前角色</span>
            <div className="role-options">
              {roleList.map((item) => (
                <button
                  className={role === item.id ? 'is-selected' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRole(item.id)
                    setSettingsOpen(false)
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.scope || item.description}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-section">
            <span className="settings-label">任务分类</span>
            <div className="segmented-control wide">
              <button className={taskGrouping === 'stage' ? 'is-selected' : ''} type="button" onClick={() => setTaskGrouping('stage')}>按业务阶段</button>
              <button className={taskGrouping === 'status' ? 'is-selected' : ''} type="button" onClick={() => setTaskGrouping('status')}>按任务状态</button>
            </div>
          </section>
          <button className="reset-button" type="button" onClick={handleReset}><RotateCcw size={15} />重置演示数据</button>
        </div>
      ) : null}
    </header>
  )
}

function TaskCard({ ticket, active, onClick }) {
  const station = stations.find((item) => item.id === ticket.stationId)
  const currentStep = flowSteps[Number(ticket.currentStep) - 1]
  const severityKey = ['urgent', 'critical', '严重'].includes(ticket.severity)
    ? 'urgent'
    : ['warning', '高', '中'].includes(ticket.severity)
      ? 'warning'
      : 'info'
  const statusKey = String(ticket.status).includes('完成')
    ? 'completed'
    : String(ticket.status).includes('挂起')
      ? 'suspended'
      : 'running'
  const severityLabel = severityKey === 'urgent' ? '紧急' : severityKey === 'warning' ? '预警' : '关注'

  return (
    <button className={`task-card ${active ? 'is-active' : ''}`} type="button" onClick={onClick}>
      <div className="task-card-title">
        <span className={`severity-dot severity-${severityKey}`} aria-hidden="true" />
        <strong>{ticket.title}</strong>
        <span className={`status-text status-${statusKey}`}>{ticket.statusLabel || ticket.status || '待审批'}</span>
      </div>
      <div className="task-card-meta"><span>{currentStep?.name || ticket.stepLabel || '异常复核'}</span><span>{station?.shortName || ticket.station || '雅砻江流域'}</span></div>
      <div className="task-card-owner"><UserRound size={14} /><span>{ticket.assignee || '技术负责人'}</span><time>{ticket.updatedAt || '08:24'}</time><span className="sr-only">{severityLabel}</span></div>
    </button>
  )
}

function NewTaskModal({ onClose }) {
  const navigate = useNavigate()
  const { createTask, showToast } = useApp()
  const [type, setType] = useState('defect')
  const [title, setTitle] = useState('')
  const [stationId, setStationId] = useState(stations[0]?.id || '')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!title.trim()) {
      showToast?.('请输入任务目的', 'warning')
      return
    }
    const created = createTask?.({ type, title: title.trim(), stationId })
    onClose()
    if (created?.id) navigate(`/ticket/${created.id}`)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="new-task-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="eyebrow">NEW WORK</span><h2>新建运维任务</h2></div>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="segmented-control wide">
          <button className={type === 'defect' ? 'is-selected' : ''} type="button" onClick={() => setType('defect')}>缺陷单</button>
          <button className={type === 'inspection' ? 'is-selected' : ''} type="button" onClick={() => setType('inspection')}>巡检任务</button>
        </div>
        <label className="field-label">
          <span>任务目的</span>
          <textarea value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：对柯拉一期高温组串进行红外复检" rows={4} />
        </label>
        <label className="field-label">
          <span>覆盖电站</span>
          <select value={stationId} onChange={(event) => setStationId(event.target.value)}>
            {stations.map((station) => <option value={station.id} key={station.id}>{station.name}</option>)}
          </select>
        </label>
        <div className="ai-prefill"><Sparkles size={16} /><span>总控 Agent 将根据任务目的预填对象、策略与时间窗。</span></div>
        <div className="modal-actions"><button className="button-secondary" type="button" onClick={onClose}>取消</button><button className="button-primary" type="submit"><Sparkles size={15} />生成任务</button></div>
      </form>
    </div>
  )
}

function Sidebar({ collapsed, onCollapse }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { role, tickets, taskGrouping } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (tickets || []).filter((ticket) => {
      const matchesQuery = !normalized || `${ticket.title} ${ticket.number || ''}`.toLowerCase().includes(normalized)
      const step = Number(ticket.currentStep) || 1
      const status = String(ticket.status || '')
      const matchesFilter = filter === 'all'
        || (filter === 'waiting' && status.includes('待'))
        || (filter === 'running' && (status.includes('中') || status.includes('复检')))
        || (filter === 'defect' && step <= 5)
        || (filter === 'dispatch' && step >= 6 && step <= 10)
        || (filter === 'closure' && step >= 11)
      return matchesQuery && matchesFilter
    })
  }, [filter, query, tickets])

  const filters = taskGrouping === 'status'
    ? [{ id: 'waiting', label: '待办' }, { id: 'running', label: '进行中' }, { id: 'all', label: '全部' }]
    : [{ id: 'defect', label: '② 缺陷生成' }, { id: 'dispatch', label: '③ 派单执行' }, { id: 'closure', label: '④ 缺陷闭环' }, { id: 'all', label: '全部' }]

  if (collapsed) return null

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-tabs">
          <button className="is-active" type="button"><ClipboardList size={16} />任务中心</button>
          <button className="icon-button sidebar-collapse" type="button" onClick={onCollapse} title="折叠任务中心"><ChevronLeft size={17} /></button>
        </div>

        <div className="sidebar-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单号 / 缺陷" /></div>
        <div className="task-filters">
          <div className="filter-scroll">
            {filters.map((item) => <button className={filter === item.id ? 'is-active' : ''} key={item.id} type="button" onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
          <button className="icon-button" type="button" title="新建任务" onClick={() => setNewTaskOpen(true)}><Plus size={17} /></button>
        </div>
        <div className="task-list">
          <button className={`report-task-card ${location.pathname === '/inspection' ? 'is-active' : ''}`} type="button" onClick={() => navigate('/inspection')}>
            <span className="report-icon"><FileChartColumn size={17} /></span>
            <span className="report-card-copy"><strong>2026 Q3 智能巡检报告</strong><small>6 模块 · 4 电站 · 5 项待处置</small><em><Sparkles size={12} />感知 Agent <time>08-13 07:30</time></em></span>
            <span className="complete-mark">已完成</span>
          </button>
          {filteredTickets.length ? filteredTickets.map((ticket) => (
            <TaskCard ticket={ticket} active={location.pathname === `/ticket/${ticket.id}`} key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} />
          )) : <div className="sidebar-empty"><Gauge size={22} /><span>当前筛选下无任务</span></div>}
        </div>

        <div className="sidebar-profile"><span className="profile-avatar"><UserRound size={16} /></span><span>{roleList.find((item) => item.id === role)?.name || '技术负责人'}</span><span className="profile-online" /></div>
      </aside>
      {newTaskOpen ? <NewTaskModal onClose={() => setNewTaskOpen(false)} /> : null}
    </>
  )
}

function Toast() {
  const { toast, clearToast } = useApp()

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => clearToast?.(), 1400)
    return () => window.clearTimeout(timer)
  }, [clearToast, toast])

  return toast ? <div className={`ops-toast toast-${toast.type || toast.tone || 'info'}`}><span className="toast-indicator" />{toast.message || toast}</div> : null
}

export default function Shell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const cockpitActive = location.pathname === '/'

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <TopBar onOpenSidebar={() => setSidebarCollapsed(false)} />
      <Sidebar collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed(true)} />
      {sidebarCollapsed ? <button className="sidebar-reveal" type="button" onClick={() => setSidebarCollapsed(false)} title="展开任务中心"><ChevronRight size={18} /></button> : null}
      <main className="app-main">
        {cockpitActive ? <CockpitPage active /> : <Outlet />}
      </main>
      <Toast />
    </div>
  )
}
