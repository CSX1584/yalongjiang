import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Robot as Bot,
  Check,
  CaretDown as ChevronDown,
  Circle,
  DotsThree as MoreHorizontal,
  Pencil,
  Plus,
  MagnifyingGlass as Search,
  Sparkle as Sparkles,
  Trash as Trash2,
  X,
} from '@phosphor-icons/react'
import { agents } from '../data/demoData'
import { useApp } from '../context/AppContext'
import {
  AgentConversation,
  AgentConversationComposer,
  AgentConversationSuggestions,
} from '../components/AgentChatPanel'
import { Button } from '@heroui/react'

const starterPrompts = [
  '本期巡检最需要关注哪些风险？',
  '两河口电站当前有哪些未闭环问题？',
  '解释扎拉山逆变器温升的可能原因',
  '给出今天优先处理的三项任务',
]

function responseFor(text) {
  if (text.includes('两河口')) {
    return '两河口当前有 7 项确认问题，其中汇流箱 04 绝缘阻抗低最需关注。该缺陷已挂起 21 天，高湿时段最低 0.18MΩ，建议备件到货后 48 小时内闭环。'
  }
  if (text.includes('扎拉山') || text.includes('温升')) {
    return '扎拉山 #5、#6 方阵热斑环比上升 22%。逆变器温升与风道压差增加相关，建议先清洁风道，再在满载时段复测；若温度仍高于 75°C，进入停机检查。'
  }
  if (text.includes('巡检') || text.includes('风险')) {
    return '本期三项高优先级风险为：组串反灌 12 次、残余电流异常 8 次、组件热斑集中复发。前两项涉及直流侧安全，建议先完成 IV 诊断与现场开盖确认。'
  }
  if (text.includes('今天') || text.includes('任务')) {
    return '今日建议顺序：1. 复核扎拉山 #14 逆变器残余电流；2. 跟进两河口汇流箱 04 备件与现场窗口；3. 安排扎拉山 #5/#6 方阵红外复测。'
  }
  return '已收到。我会结合场站实时数据、巡检报告和在办工单继续分析。当前没有发现需要改变既定处置优先级的新证据。'
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function isAgentMessage(message) {
  return message.type === 'agent'
    || ['agent', 'assistant'].includes(message.role)
    || message.kind === 'agent'
    || message.sender === 'agent'
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { chatId } = useParams()
  const {
    chatThreads,
    closeChat,
    ensureChat,
    selectChat,
    updateChatMessages,
    updateChatThread,
    removeChat,
  } = useApp()
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const messageEndRef = useRef(null)

  // 全屏工作台与停靠栏只保留一份会话状态；工单同步线程仍由工单页展示。
  const sessions = useMemo(
    () => chatThreads.filter((thread) => !String(thread.id).startsWith('ticket-')),
    [chatThreads],
  )

  const visibleSessions = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter((session) => String(session.title ?? '').toLowerCase().includes(keyword))
  }, [query, sessions])
  const activeSession = sessions.find((session) => session.id === chatId) ?? sessions[0]
  const activeAgent = agents.find((agent) => agent.id === activeSession?.agentId) ?? agents[0]
  const conversationMessages = useMemo(
    () => (activeSession?.messages ?? []).map((message) => {
      const fromAgent = isAgentMessage(message)
      return {
        ...message,
        type: message.type ?? (message.role === 'staff' ? 'staff' : fromAgent ? 'agent' : 'user'),
        actor: message.actor ?? (fromAgent ? activeAgent?.name ?? '诊断 Agent' : '我'),
        time: message.time ?? message.at,
        content: message.content ?? message.text,
      }
    }),
    [activeAgent?.name, activeSession?.messages],
  )

  // 进入全屏工作台时关闭覆盖式 Dock，避免同一会话出现两份输入区。
  useEffect(() => {
    closeChat?.()
  }, [closeChat])

  useEffect(() => {
    if (!activeSession) return
    selectChat(activeSession.id)
    if (chatId !== activeSession.id) navigate(`/chat/${activeSession.id}`, { replace: true })
  }, [activeSession?.id, chatId, navigate, selectChat])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' })
  }, [activeSession?.messages?.length])

  useEffect(() => {
    setInput('')
    setAgentMenuOpen(false)
  }, [activeSession?.id])

  if (!activeSession) return null

  const updateSession = (id, update) => updateChatThread(id, update)

  const createSession = () => {
    const id = `chat-${Date.now()}`
    const at = nowTime()
    const next = {
      id,
      title: '新建对话',
      agentId: agents[0]?.id ?? 'diagnosis',
      updatedAt: at,
      messages: [{ id: `${id}-welcome`, type: 'agent', role: 'agent', actor: agents[0]?.name ?? '诊断 Agent', content: '我已接入场站运行、巡检和工单数据。请选择一个问题开始分析。', time: at }],
    }
    ensureChat(next)
    navigate(`/chat/${id}`)
  }

  const deleteSession = (id) => {
    const remaining = sessions.filter((session) => session.id !== id)
    removeChat(id)
    if (remaining.length) {
      if (id === activeSession.id) navigate(`/chat/${remaining[0].id}`)
      return
    }
    const at = nowTime()
    const replacement = {
      id: `chat-${Date.now()}`,
      title: '新建对话',
      agentId: agents[0]?.id ?? 'diagnosis',
      updatedAt: at,
      messages: [],
    }
    ensureChat(replacement)
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
    const stamp = Date.now()
    updateChatMessages(activeSession.id, (messages) => [
      ...(messages ?? []),
      { id: `${activeSession.id}-u-${stamp}`, type: 'user', role: 'user', actor: '我', content: text, time: at },
      { id: `${activeSession.id}-a-${stamp}`, type: 'agent', role: 'agent', actor: activeAgent?.name ?? '诊断 Agent', content: responseFor(text), time: at },
    ])
    setInput('')
  }

  const changeAgent = (agentId) => {
    updateSession(activeSession.id, { agentId })
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
        <Button className="new-chat-button ops-heroui-button" type="button" variant="secondary" size="sm" onPress={createSession}><Plus size={16} />新建会话</Button>
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
            <Button className="button-secondary ops-heroui-button" type="button" variant="secondary" size="sm" onPress={() => setAgentMenuOpen((open) => !open)}>
              切换智能体<ChevronDown size={14} />
            </Button>
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

        <AgentConversation
          messages={conversationMessages}
          sendText={sendMessage}
          streamClassName="message-feed"
          beforeMessages={<div className="message-date"><span />今天<span /></div>}
          empty={(
            <div className="chat-empty">
              <span><Sparkles size={24} /></span>
              <h2>开始一次运维分析</h2>
              <p>{activeAgent?.description ?? '智能体已接入场站、设备、巡检与工单数据。'}</p>
            </div>
          )}
          afterMessages={<div ref={messageEndRef} />}
          footer={(
            <footer className="chat-composer-area">
              <AgentConversationSuggestions
                presets={starterPrompts}
                onSuggestionSelect={(item) => sendMessage(typeof item === 'string' ? item : item?.question)}
              />
              <AgentConversationComposer
                draft={input}
                setDraft={setInput}
                submitMessage={() => sendMessage()}
                placeholder="询问场站、设备、巡检或工单问题"
                ariaLabel="询问场站、设备、巡检或工单问题"
              />
            </footer>
          )}
        />
      </main>
    </div>
  )
}
