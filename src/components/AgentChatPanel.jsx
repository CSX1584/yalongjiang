import { useEffect, useRef, useState } from 'react'
import {
  Airplane,
  Atom,
  Broadcast,
  Robot as Bot,
  Brain,
  Books,
  CaretDown,
  Check,
  // CaretLineRight, // 无用导入（随下方注释掉的默认导出一起待删）
  ClipboardText,
  PaperPlaneTilt as Send,
  PauseCircle,
  SealCheck,
  User as UserRound,
  UserFocus,
  Wrench,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { REASONING_NODE_LOOKUP } from './ReasoningChain'

// 每个智能体一个专属图标与配色，对话流里一眼区分是哪个 agent 在说话
const AGENT_AVATAR_META = {
  诊断agent: { Icon: Brain, tone: 'diagnose' },
  派单Agent: { Icon: ClipboardText, tone: 'dispatch' },
  执行Agent: { Icon: Wrench, tone: 'execute' },
  验证Agent: { Icon: SealCheck, tone: 'validate' },
  知识Agent: { Icon: Books, tone: 'learn' },
  巡检Agent: { Icon: Airplane, tone: 'inspect' },
  主控Agent: { Icon: Atom, tone: 'orchestrator' },
  感知Agent: { Icon: Broadcast, tone: 'perception' },
}
const FALLBACK_AGENT_AVATAR = { Icon: Bot, tone: 'default' }

// 演示选项卡图标：A 生成缺陷单 / B 无人机巡检 / C 人工巡检 / D 挂起
const ACTION_ICONS = { clipboard: ClipboardText, drone: Airplane, user: UserFocus, pause: PauseCircle }

/**
 * KPI 数据卡片网格：主控agent气泡/对话消息内的电站指标卡
 */
export function KpiCardGrid({ items }) {
  if (!items?.length) return null
  return (
    <div className="kpi-card-grid">
      {items.map((kpi) => (
        <div className={`kpi-card is-${kpi.tone ?? 'normal'}`} key={kpi.id ?? kpi.label}>
          <span className="kpi-card__label">{kpi.label}</span>
          <span className="kpi-card__value">
            {kpi.value}
            <em>{kpi.unit}</em>
          </span>
          <span className={`kpi-card__trend is-${kpi.trendTone ?? 'positive'}`}>
            {kpi.trend} · {kpi.note}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * 对话流缺陷单确认卡：标题+状态、故障原因、处理代价，操作按钮内嵌卡片底部
 * status/viewLabel/confirmLabel 可覆盖默认文案（运维负责人工单审批卡复用同款样式）
 */
export function DefectActionCard({ ticket, cause, cost, onView, onConfirm, status, viewLabel, confirmLabel }) {
  if (!ticket) return null
  return (
    <div className="chat-defect-card">
      <div className="chat-defect-card__head">
        <strong>{ticket.title}</strong>
        <span className="chat-defect-card__status">{status ?? '缺陷单已生成 · 待确认'}</span>
      </div>
      <div className="chat-defect-card__rows">
        <div className="chat-defect-card__row">
          <span>故障原因</span>
          <p>{cause}</p>
        </div>
        <div className="chat-defect-card__row">
          <span>处理代价</span>
          <p>{cost}</p>
        </div>
      </div>
      <div className="chat-defect-card__actions">
        <button type="button" onClick={() => onView?.(ticket)}>{viewLabel ?? '查看缺陷单'}</button>
        <button className="is-primary" type="button" onClick={() => onConfirm?.(ticket)}>{confirmLabel ?? '去确认'}</button>
      </div>
    </div>
  )
}

/**
 * 思维链步骤列表：步骤按 1-n 纵向排列，文字在上、关联推理节点的联动胶囊在文字下方横排
 * 行支持 { text, nodeId | nodeIds }：命中推理链节点的 id 渲染为联动胶囊，点击选中并高亮右侧节点
 */
function ThinkLines({ lines }) {
  const { focusReasoningNode } = useApp()
  return (
    <ol className="chat-think__lines">
      {lines.map((line, index) => {
        const text = typeof line === 'string' ? line : line.text
        const nodeIds = typeof line === 'object' && line
          ? (Array.isArray(line.nodeIds) ? line.nodeIds : line.nodeId ? [line.nodeId] : [])
          : []
        const nodes = nodeIds.map((id) => REASONING_NODE_LOOKUP[id]).filter(Boolean)
        return (
          <li className="chat-think__step" key={nodes[0]?.id ?? index}>
            <span className="chat-think__step-index" aria-hidden="true">{index + 1}</span>
            <div className="chat-think__step-body">
              <p>{text}</p>
              {nodes.length > 0 && (
                <div className="chat-think__chips">
                  {nodes.map((node) => (
                    <button
                      className="chat-think__node-chip"
                      key={node.id}
                      type="button"
                      onClick={() => focusReasoningNode?.(node.id)}
                      title={`定位思维链节点：${node.title}`}
                    >
                      {node.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * 气泡内思维链：默认收起，点击展开 AI 在该环节完成的思考步骤
 */
function ThinkChain({ data }) {
  const [open, setOpen] = useState(false)
  if (!data?.lines?.length) return null

  return (
    <div className={`chat-think${open ? ' is-open' : ''}`}>
      <button
        className="chat-think__head"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>{data.title}</span>
        <CaretDown className="chat-think__chevron" size={12} aria-hidden="true" />
      </button>
      {open ? <ThinkLines lines={data.lines} /> : null}
    </div>
  )
}

/**
 * 柯拉演示消息体：生命周期自驱动动画
 * thinking（计时 0→duration，期间正文不出）→ checking（checklist 逐项打勾）→ done（正文/缺陷卡出现）
 * think.lines 演示脚本为纯文本，直接逐条展示
 */
function KolaMessageBody({ message }) {
  const { advanceKolaDemo, hasAnimPlayed, markAnimPlayed } = useApp()
  // 播放一次：重开对话窗或消息再次同步时不重播动画，直接呈现完成态
  const [played] = useState(() => Boolean(hasAnimPlayed?.(message.id)))
  const thinkDuration = message.think?.duration ?? 0
  const checklist = message.checklist ?? []
  const [elapsed, setElapsed] = useState(played ? thinkDuration : 0)
  const [thinkDone, setThinkDone] = useState(played || thinkDuration === 0)
  const [checked, setChecked] = useState(played ? checklist.length : 0)
  const [open, setOpen] = useState(false)
  const checksDone = checked >= checklist.length
  const ready = thinkDone && checksDone

  // 动画完成即登记，后续挂载直接完成态
  useEffect(() => {
    if (ready) markAnimPlayed?.(message.id)
  }, [markAnimPlayed, message.id, ready])

  // 思考计时：每 100ms 从 0 向上数，到达 duration 定格
  useEffect(() => {
    if (thinkDone) return undefined
    const started = Date.now()
    const timer = window.setInterval(() => {
      const value = Date.now() - started
      if (value >= thinkDuration) {
        setElapsed(thinkDuration)
        setThinkDone(true)
        window.clearInterval(timer)
      } else {
        setElapsed(value)
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [thinkDuration, thinkDone])

  // 思考完成后逐项打勾，每项 700ms
  useEffect(() => {
    if (!thinkDone || checksDone || checklist.length === 0) return undefined
    const timer = window.setTimeout(() => setChecked((value) => value + 1), 700)
    return () => window.clearTimeout(timer)
  }, [thinkDone, checksDone, checklist.length])

  return (
    <>
      {message.think ? (
        <div className={`chat-think is-live${thinkDone ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
          <button
            className="chat-think__head"
            type="button"
            onClick={() => thinkDone && setOpen((value) => !value)}
            aria-expanded={open}
          >
            <span>{thinkDone ? `已深度思考 · 用时 ${(thinkDuration / 1000).toFixed(1)}s` : `正在深度思考 · ${(elapsed / 1000).toFixed(1)}s`}</span>
            {thinkDone
              ? <CaretDown className="chat-think__chevron" size={12} aria-hidden="true" />
              : <span className="chat-think__spinner" aria-hidden="true" />}
          </button>
          {open && thinkDone ? <ThinkLines lines={message.think.lines ?? []} /> : null}
        </div>
      ) : null}
      {thinkDone && checklist.length > 0 ? (
        <div className="kola-checklist">
          {checklist.map((item, index) => (
            <div className={`kola-checklist__item${index < checked ? ' is-done' : ''}`} key={item}>
              <span className="kola-checklist__tick" aria-hidden="true">
                {index < checked ? <Check size={11} weight="bold" /> : index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}
      {ready && message.content ? (
        <div className="ticket-qa__bubble"><p>{message.content}</p></div>
      ) : null}
      {ready && message.defectCard ? (
        <div className="chat-defect-card">
          <div className="chat-defect-card__head">
            <strong>{message.defectCard.title}</strong>
            <span className="chat-defect-card__status">诊断完成 · 请选择处置方式</span>
          </div>
          <div className="chat-defect-card__rows">
            <div className="chat-defect-card__row">
              <span>故障原因</span>
              <p>{message.defectCard.cause}</p>
            </div>
            <div className="chat-defect-card__row">
              <span>处理代价</span>
              <p>{message.defectCard.cost}</p>
            </div>
          </div>
          <div className="chat-defect-card__choices">
            {message.defectCard.choices.map((choice) => {
              const ChoiceIcon = ACTION_ICONS[choice.icon] ?? ClipboardText
              return (
                <button
                  className="chat-defect-card__choice"
                  key={choice.key}
                  type="button"
                  onClick={() => advanceKolaDemo?.(choice.key)}
                >
                  <span className="chat-defect-card__choice-head">
                    <ChoiceIcon size={14} aria-hidden="true" />
                    <strong>{choice.key} · {choice.label}</strong>
                  </span>
                  <span className="chat-defect-card__choice-desc">{choice.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </>
  )
}

// AI 预置问答：命中预置问题给出演示回答
const PRESET_QA = [  {
    question: '这个缺陷的根因是什么？',
    answer: 'AI 诊断结论：连接件接触电阻升高导致局部发热，形成持续性组件热斑。红外温差 38℃、组串电流偏低 23%、IV 曲线呈热斑阶梯特征，三源证据交叉验证置信度 91%。',
  },
  {
    question: '处理需要哪些备件和人员？',
    answer: '建议川西检修一组 2 人作业：备件为同型号光伏组件 3 块、直流连接器 6 套；作业窗口推荐明日 10:30-12:00 低辐照时段。',
  },
  {
    question: '不处理会有什么风险？',
    answer: '热斑持续存在将导致组件局部温度进一步升高，存在组件烧毁与直流侧起火风险，发电偏差将随热斑扩大持续恶化，建议 48 小时内转工单处置。',
  },
]

/**
 * 智能体对话状态：输入草稿、预置问题轮播、模拟回复，消息流由调用方持有
 * resolveReply(text)：可选指令拦截，返回字符串或 { reply, delay, nextDraft, act }
 *   reply 回复文案、delay 回复延迟毫秒、nextDraft 发送后预填输入框、act 回复落流时执行的副作用
 * presets：可选胶囊列表，默认缺陷诊断预置问答；无 answer 的纯指令胶囊发送后清空输入框
 * initialDraft：挂载时预填输入框的文案（侧栏输入框指令的 nextDraft 透传）
 */
export function useAgentChat(setMessages, resolveReply, presets = PRESET_QA, initialDraft = '') {
  const [draft, setDraft] = useState(initialDraft)
  const [presetIndex, setPresetIndex] = useState(0)
  const replyTimerRef = useRef(null)

  // 发送指定文本：气泡内动作卡片（如「开始巡检」）点击时直接发消息，不经过输入框
  const dispatchMessage = (rawText) => {
    const text = String(rawText ?? '').trim()
    if (!text) return
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const preset = presets[presetIndex]
    const isPreset = Boolean(preset) && text === preset.question
    const commandResult = resolveReply?.(text)
    const command = typeof commandResult === 'string' ? { reply: commandResult } : (commandResult ?? null)
    setMessages((list) => [...list, { id: `user-${Date.now()}`, type: 'user', time: now, content: text }])
    // 命中带答案的预置问答才轮播预填下一条，纯指令胶囊发送后按指令要求预填或清空
    const rotate = isPreset && Boolean(preset.answer)
    const nextPreset = rotate ? presets[presetIndex + 1] : null
    if (rotate) setPresetIndex(presetIndex + 1)
    setDraft(nextPreset?.question ?? command?.nextDraft ?? '')
    if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current)
    replyTimerRef.current = window.setTimeout(() => {
      command?.act?.()
      // 指令可携带多条回复气泡（含思维链/指定 actor），否则单条文本回复
      const replies = command?.messages
        ? command.messages.map((message, index) => ({
            id: `agent-${Date.now()}-${index}`,
            type: 'agent',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            ...message,
          }))
        : [{
            id: `agent-${Date.now()}`,
            type: 'agent',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            content: isPreset && preset.answer
              ? preset.answer
              : command?.reply ?? '已收到，诊断agent将结合缺陷单字段与历史工单继续分析。',
          }]
      setMessages((list) => [...list, ...replies])
      replyTimerRef.current = null
    }, command?.delay ?? 420)
  }

  const submitMessage = () => dispatchMessage(draft)

  const pickPreset = (index) => {
    setDraft(presets[index].question)
    setPresetIndex(index)
  }

  return { draft, setDraft, submitMessage, sendText: dispatchMessage, pickPreset, presets }
}

/**
 * 对话内容区：消息流 + 胶囊建议 + 输入框，缺陷单抽屉与任务中心对话窗口共用
 * renderToolbar：可选，渲染输入框内底部工具行（附件/模式/模型/发送），提供时隐藏右上角发送按钮
 * renderApproval：可选，渲染消息上的流程审批卡（按钮直接推进工单流程）
 */
export function AgentConversation({ messages, draft, setDraft, submitMessage, sendText, pickPreset, presets, renderToolbar, renderApproval }) {
  const { advanceKolaDemo } = useApp()
  const streamRef = useRef(null)
  // 新气泡追加在底部后视图跟随滚到底；MutationObserver 覆盖动画揭示内容引起的高度增长
  useEffect(() => {
    const stream = streamRef.current
    if (!stream) return undefined
    const follow = () => { stream.scrollTop = stream.scrollHeight }
    follow()
    const observer = new MutationObserver(follow)
    observer.observe(stream, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [messages])
  return (
    <>
      <div className="ticket-qa__stream" ref={streamRef}>
        {messages.length === 0 ? (
          <div className="ticket-qa__empty">暂无问答记录</div>
        ) : messages.map((message) => {
          // user 与 staff（工单流程里的人员发言）都渲染为右侧气泡
          const isUser = message.type === 'user' || message.type === 'staff'
          const agentAvatar = isUser ? null : (AGENT_AVATAR_META[message.actor] ?? FALLBACK_AGENT_AVATAR)
          const AvatarIcon = isUser ? UserRound : agentAvatar.Icon
          // 柯拉演示消息：think 带 duration / 含 checklist / 含 defectCard 时走自驱动动画
          const isKolaAnim = !isUser && Boolean(message.think?.duration != null || message.checklist || message.defectCard)
          return (
            <article className={`ticket-qa__message ticket-qa__message--${isUser ? 'user' : 'agent'}`} key={message.id}>
              <span className={`ticket-qa__avatar${agentAvatar ? ` ticket-qa__avatar--${agentAvatar.tone}` : ''}`} aria-hidden="true"><AvatarIcon size={16} /></span>
              <div className="ticket-qa__main">
                <div className="ticket-qa__meta">
                  <strong>{message.actor ?? (isUser ? '运维值班员' : '诊断agent')}</strong>
                  <time>{message.time}</time>
                </div>
                {isKolaAnim ? <KolaMessageBody message={message} /> : (
                  <>
                    {/* 思维链是独立卡片，不套在气泡里 */}
                    {message.think ? <ThinkChain data={message.think} /> : null}
                    {message.content ? (
                      <div className="ticket-qa__bubble">
                        <p>{message.content}</p>
                      </div>
                    ) : null}
                  </>
                )}
                {/* 演示多选项卡：key 选项点击走演示状态机（A/B/C/D），等价于按空格选 A */}
                {message.actions?.length ? (
                  <div className="ticket-qa__action-group">
                    {message.actions.map((action) => {
                      const ActionIcon = ACTION_ICONS[action.icon] ?? ClipboardText
                      return (
                        <button
                          className="ticket-qa__action-card"
                          key={action.key}
                          type="button"
                          onClick={() => advanceKolaDemo?.(action.key)}
                        >
                          <ActionIcon size={14} aria-hidden="true" />
                          <span>{action.key} · {action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {/* 动作卡片：点击等同发送指定文字（如「开始巡检」触发批量分析） */}
                {message.action ? (
                  <button
                    className="ticket-qa__action-card"
                    type="button"
                    onClick={() => sendText?.(message.action.sendText ?? message.action.label)}
                  >
                    <Airplane size={14} aria-hidden="true" />
                    <span>{message.action.label}</span>
                  </button>
                ) : null}
                {/* 流程审批卡：按钮直接推进工单流程，状态由渲染方按工单实时数据推导 */}
                {message.approval && renderApproval ? renderApproval(message.approval) : null}
              </div>
            </article>
          )
        })}
      </div>

      {presets.length > 0 && (
        <div className="ticket-qa__suggestions">
          {presets.map((item, index) => (
            <button key={item.question} type="button" onClick={() => pickPreset(index)}>
              {item.question}
            </button>
          ))}
        </div>
      )}

      <div className={`ticket-composer ticket-qa__composer${renderToolbar ? ' ticket-composer--stacked' : ''}`}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submitMessage()
            }
          }}
          rows={1}
          placeholder="向诊断agent提问"
          aria-label="向诊断agent提问"
        />
        {renderToolbar ? renderToolbar({ sendDisabled: !draft.trim(), onSend: submitMessage }) : (
          <button
            className="ticket-composer__send"
            type="button"
            disabled={!draft.trim()}
            onClick={submitMessage}
            aria-label="发送"
            title="发送"
          >
            <Send size={17} />
          </button>
        )}
      </div>
    </>
  )
}

// 无用代码（待确认后删除）：缺陷管理页右侧抽屉，无任何文件以默认导入引用
// export default function AgentChatPanel({ onCollapse }) {
//   const [messages, setMessages] = useState([])
//   const chat = useAgentChat(setMessages)
//
//   return (
//     <aside className="ticket-qa" aria-label="AI 智能问答">
//       <header className="ticket-qa__header">
//         <span className="ticket-qa__brand" role="img" aria-label="缺陷诊断智能体" />
//         <button
//           className="ticket-qa__collapse"
//           type="button"
//           onClick={onCollapse}
//           aria-label="收起AI对话框"
//           title="收起AI对话框"
//         >
//           <CaretLineRight size={15} />
//         </button>
//       </header>
//       <AgentConversation messages={messages} {...chat} />
//     </aside>
//   )
// }
