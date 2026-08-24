import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Robot as Bot,
  Check,
  CaretDown as ChevronDown,
  Circle,
  Clock as Clock3,
  DotsThree as MoreHorizontal,
  Pencil,
  Plus,
  MagnifyingGlass as Search,
  PaperPlaneTilt as Send,
  Sparkle as Sparkles,
  Trash as Trash2,
  User as UserRound,
  X,
} from '@phosphor-icons/react'
import { agents, chatSessions as demoChatSessions } from '../data/demoData'

const starterPrompts = [
  '本期巡检最需要关注哪些风险？',
  '两河口电站当前有哪些未闭环问题？',
  '解释扎拉山逆变器温升的可能原因',
  '给出今天优先处理的三项任务',
]

const fallbackSessions = [
  {
    id: 'ops-daily',
    title: '今日运维风险研判',
    agentId: 'diagnosis',
    updatedAt: '16:42',
    messages: [
      { id: 'm-1', role: 'agent', text: '已汇总四座场站的实时告警、在办工单与巡检报告。当前优先关注扎拉山逆变器温升和两河口绝缘阻抗低。', at: '16:40' },
    ],
  },
]

function cloneSessions(source) {
  return source.map((session) => ({
    ...session,
    messages: (session.messages ?? []).map((message) => ({ ...message })),
  }))
}

function responseFor(text) {
  if (text.includes('两河口')) {
    return '两河口当前有 7 项确认问题，其中汇流箱 04 绝缘阻抗低最需关注。该缺陷已挂起 21 天，高湿时段最低 0.18MΩ，建议备件到货后 48 小时内闭环。'
  }
  if (text.includes('扎拉山') || text.includes('温升')) {
    return '扎拉山 #5、#6 方阵热斑环比上升 22%。逆变器温升与风道压差增加相关，建议先清洁风道，再在满载时段复测；若温度仍高于 75°C，进入停机检查。'
  }
  if (text.includes('巡检') || text.includes('风险')) {
    return '本期三项高优先级风险为：组串反灌 548 次、残余电流异常 8 次、组件热斑集中复发。前两项涉及直流侧安全，建议先完成 IV 诊断与现场开盖确认。'
  }
  if (text.includes('今天') || text.includes('任务')) {
    return '今日建议顺序：1. 复核扎拉山 #14 逆变器残余电流；2. 跟进两河口汇流箱 04 备件与现场窗口；3. 安排扎拉山 #5/#6 方阵红外复测。'
  }
  return '已收到。我会结合场站实时数据、巡检报告和在办工单继续分析。当前没有发现需要改变既定处置优先级的新证据。'
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { chatId } = useParams()
  const [sessions, setSessions] = useState(() => cloneSessions(demoChatSessions?.length ? demoChatSessions : fallbackSessions))
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const messageEndRef = useRef(null)

  const visibleSessions = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter((session) => session.title.toLowerCase().includes(keyword))
  }, [query, sessions])
  const activeSession = sessions.find((session) => session.id === chatId) ?? sessions[0]
  const activeAgent = agents.find((agent) => agent.id === activeSession?.agentId) ?? agents[0]

  useEffect(() => {
    if (!activeSession) return
    if (chatId !== activeSession.id) navigate(`/chat/${activeSession.id}`, { replace: true })
  }, [activeSession, chatId, navigate])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' })
  }, [activeSession?.messages?.length])

  if (!activeSession) return null

  const updateSession = (id, update) => {
    setSessions((current) => current.map((session) => session.id === id ? update(session) : session))
  }

  const createSession = () => {
    const id = `chat-${Date.now()}`
    const next = {
      id,
      title: '新建运维会话',
      agentId: agents[0]?.id ?? 'diagnosis',
      updatedAt: nowTime(),
      messages: [{ id: `${id}-welcome`, role: 'agent', text: '我已接入场站运行、巡检和工单数据。请选择一个问题开始分析。', at: nowTime() }],
    }
    setSessions((current) => [next, ...current])
    navigate(`/chat/${id}`)
  }

  const deleteSession = (id) => {
    const remaining = sessions.filter((session) => session.id !== id)
    if (remaining.length) {
      setSessions(remaining)
      if (id === activeSession.id) navigate(`/chat/${remaining[0].id}`)
      return
    }
    const replacement = {
      id: `chat-${Date.now()}`,
      title: '新建运维会话',
      agentId: agents[0]?.id ?? 'diagnosis',
      updatedAt: nowTime(),
      messages: [],
    }
    setSessions([replacement])
    navigate(`/chat/${replacement.id}`)
  }

  const beginRename = (session) => {
    setRenamingId(session.id)
    setRenameDraft(session.title)
  }

  const commitRename = () => {
    const title = renameDraft.trim()
    if (title) updateSession(renamingId, (session) => ({ ...session, title }))
    setRenamingId(null)
  }

  const sendMessage = (rawText = input) => {
    const text = rawText.trim()
    if (!text) return
    const at = nowTime()
    updateSession(activeSession.id, (session) => ({
      ...session,
      title: session.title === '新建运维会话' ? text.slice(0, 18) : session.title,
      updatedAt: at,
      messages: [
        ...(session.messages ?? []),
        { id: `${session.id}-u-${Date.now()}`, role: 'user', text, at },
        { id: `${session.id}-a-${Date.now()}`, role: 'agent', text: responseFor(text), at },
      ],
    }))
    setInput('')
  }

  const changeAgent = (agentId) => {
    updateSession(activeSession.id, (session) => ({ ...session, agentId }))
    setAgentMenuOpen(false)
  }

  return (
    <div className="ops-page chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading">
          <button className="icon-button" type="button" onClick={() => navigate('/')} title="返回驾驶舱">
            <ArrowLeft size={18} />
          </button>
          <div><p className="eyebrow">AI WORKSPACE</p><h1>智能体对话</h1></div>
        </div>
        <button className="new-chat-button" type="button" onClick={createSession}><Plus size={16} />新建会话</button>
        <label className="chat-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话" />
          {query && <button type="button" onClick={() => setQuery('')} title="清空搜索"><X size={13} /></button>}
        </label>
        <div className="session-list">
          <p className="session-group-label">最近会话</p>
          {visibleSessions.map((session) => {
            const selected = session.id === activeSession.id
            const sessionAgent = agents.find((agent) => agent.id === session.agentId) ?? agents[0]
            return (
              <div className={`session-row ${selected ? 'is-active' : ''}`} key={session.id}>
                <button className="session-open" type="button" onClick={() => navigate(`/chat/${session.id}`)}>
                  <span className="agent-mini"><Bot size={14} /></span>
                  <span>
                    <strong>{session.title}</strong>
                    <small>{sessionAgent?.shortName ?? sessionAgent?.name ?? '智能体'} · {session.updatedAt}</small>
                  </span>
                </button>
                {renamingId === session.id && (
                  <input
                    className="session-rename-input"
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename()
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                    autoFocus
                  />
                )}
                <span className="session-actions">
                  {renamingId === session.id ? (
                    <button type="button" onClick={commitRename} title="确认改名"><Check size={13} /></button>
                  ) : (
                    <button type="button" onClick={() => beginRename(session)} title="重命名"><Pencil size={13} /></button>
                  )}
                  <button type="button" onClick={() => deleteSession(session.id)} title="删除会话"><Trash2 size={13} /></button>
                </span>
              </div>
            )
          })}
        </div>
        <div className="agent-status-summary">
          <span className="agent-status-icon"><Sparkles size={16} /></span>
          <div><strong>{agents.filter((agent) => agent.status === 'online' || agent.status === 'working').length || agents.length} 个智能体在线</strong><small>数据已同步至 16:48</small></div>
        </div>
      </aside>

      <main className="chat-workspace">
        <header className="chat-toolbar">
          <div className="active-agent">
            <span className="agent-avatar"><Bot size={20} /></span>
            <div><h2>{activeAgent?.name ?? '诊断 Agent'}</h2><p><Circle size={7} fill="currentColor" />在线 · 已接入实时运行数据</p></div>
          </div>
          <div className="agent-picker">
            <button className="button-secondary" type="button" onClick={() => setAgentMenuOpen((open) => !open)}>
              切换智能体<ChevronDown size={14} />
            </button>
            {agentMenuOpen && (
              <div className="agent-menu">
                {agents.map((agent) => (
                  <button className={agent.id === activeAgent?.id ? 'is-active' : ''} type="button" key={agent.id} onClick={() => changeAgent(agent.id)}>
                    <span><Bot size={15} /></span><div><strong>{agent.name}</strong><small>{agent.description}</small></div>
                    {agent.id === activeAgent?.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-button" type="button" title="更多操作"><MoreHorizontal size={18} /></button>
        </header>

        <section className="message-feed">
          <div className="message-date"><span />今天<span /></div>
          {(activeSession.messages ?? []).map((message) => {
            const fromAgent = ['agent', 'assistant'].includes(message.role) || message.kind === 'agent' || message.sender === 'agent'
            return (
              <article className={`chat-message ${fromAgent ? 'agent' : 'user'}`} key={message.id}>
                <span className="message-avatar">{fromAgent ? <Bot size={16} /> : <UserRound size={16} />}</span>
                <div className="message-body">
                  <header><strong>{fromAgent ? activeAgent?.name ?? '诊断 Agent' : '我'}</strong><time><Clock3 size={11} />{message.at ?? message.time}</time></header>
                  <div className="message-bubble"><p>{message.text ?? message.content}</p></div>
                </div>
              </article>
            )
          })}
          {!activeSession.messages?.length && (
            <div className="chat-empty">
              <span><Sparkles size={24} /></span>
              <h2>开始一次运维分析</h2>
              <p>{activeAgent?.description ?? '智能体已接入场站、设备、巡检与工单数据。'}</p>
            </div>
          )}
          <div ref={messageEndRef} />
        </section>

        <footer className="chat-composer-area">
          <div className="prompt-chips">
            {starterPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}
          </div>
          <div className="chat-composer">
            <span className="composer-agent"><Bot size={17} /></span>
            <textarea
              rows="1"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="询问场站、设备、巡检或工单问题"
            />
            <button className="send-button" type="button" onClick={() => sendMessage()} disabled={!input.trim()} title="发送">
              <Send size={16} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
