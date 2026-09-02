import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CaretLeft,
  Check,
  Plus,
  Sparkle as Sparkles,
} from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { fieldsFromRows } from '../components/TicketStageContent'
import { KOLA_DEFECT_ROWS } from '../data/demoData'

// 缺陷单输入项，与缺陷确认节点编辑弹窗字段一致
const DEFECT_ROWS = [
  ['缺陷编号', 'QX-20260813-004'], ['发现单位', '雅砻江流域集控中心'], ['发现人', '运维值班员 王磊'], ['发现日期', '2026-08-18'],
  ['缺陷类别', 'II 级 / 重要缺陷'], ['责任班组', '川西检修一组'], ['责任人', '张斌'], ['厂站', '两河口光储电站'],
  ['设备码', 'LHK-PV-03-07'], ['设备描述', '#3 方阵 7 号组串光伏组件'], ['状态', '待确认转工单'], ['故障类别', '组件热斑'],
  ['辅助现象', '红外温差 38℃ · 组串电流偏低 23%'], ['工单编号', 'GD-20260813-011'],
  ['缺陷原因', '接头电阻变大，局部一直发热'],
  ['处理措施', '换掉 3 块热斑组件，拧紧直流接头'],
]

// 缺陷原因、处理措施统一使用通栏多行输入
const WIDE_LABELS = ['缺陷原因', '处理措施']
const DEFECT_FIELDS = fieldsFromRows(DEFECT_ROWS).map((field) =>
  WIDE_LABELS.includes(field.label) ? { ...field, multiline: true } : field,
)

// 柯拉一期演示缺陷单字段：打字机预填的数据源，结构与 DEFECT_FIELDS 一致
const KOLA_DEFECT_FIELDS = fieldsFromRows(KOLA_DEFECT_ROWS).map((field) =>
  WIDE_LABELS.includes(field.label) ? { ...field, multiline: true } : field,
)

// 缺陷单列表演示数据
const DEFECT_LIST = [
  { id: 'QXD-20260820-021', desc: '#7 方阵组串防反回路反灌', level: 'III 级 / 一般缺陷', levelTone: 'warning', category: '组串反灌', status: '待确认转工单', statusTone: 'pending', station: '扎拉山光储电站', date: '2026-08-20', reporter: '王磊' },
  { id: 'QX-20260813-004', desc: '#3 方阵 7 号组串光伏组件热斑', level: 'II 级 / 重要缺陷', levelTone: 'urgent', category: '组件热斑', status: '待确认转工单', statusTone: 'pending', station: '两河口光储电站', date: '2026-08-18', reporter: '王磊' },
  { id: 'QXD-20260820-018', desc: '2 区 #07 逆变器脱网', level: 'II 级 / 重要缺陷', levelTone: 'urgent', category: '逆变器故障', status: '已转工单', statusTone: 'done', station: '柯拉一期光伏电站', date: '2026-08-20', reporter: '李婷' },
  { id: 'QXD-20260817-009', desc: '#12 方阵汇流箱通讯中断', level: 'IV 级 / 轻微缺陷', levelTone: 'info', category: '通讯异常', status: '已结案', statusTone: 'closed', station: '腊巴山光风储电站', date: '2026-08-17', reporter: '陈浩' },
]

// AI 润色转写：从当前输入提取关键数据生成规范描述，输入变化即重新转写（演示环境为本地模板）
const POLISH_GENERATORS = {
  '缺陷原因': (text) => {
    const source = String(text)
    const temp = (source.match(/\d+\s*℃/) || ['38℃'])[0]
    const cause = source.includes('电阻') ? '直流侧连接件接触电阻升高' : source.includes('热斑') ? '组件内部电池片失配' : '连接件接触异常'
    return `经 AI 诊断，${cause}导致局部持续发热，形成组件热斑；红外测温显示热点温差达 ${temp}，与组串电流偏低、IV 曲线阶梯特征相互印证，缺陷机理明确。`
  },
  '处理措施': (text) => {
    const count = (String(text).match(/\d+\s*块/) || ['3 块'])[0]
    return `停电隔离后更换 ${count}热斑组件，复紧直流侧连接件并复测接触电阻；作业完成后进行 IV 曲线测试与红外复测，确认热斑消除、组串电流恢复正常后方可并网。`
  },
}

// 缺陷类别到任务严重度的映射
const SEVERITY_BY_LEVEL = { I: '紧急', II: '严重', III: '高', IV: '关注' }

/**
 * 缺陷管理页面：默认显示缺陷单列表，点击右上角加号进入缺陷单录入表单（交互流程保持不变）
 */
export default function DefectManagementPage() {
  const { showToast, defectFormRequest, clearDefectFormRequest, createTask, autoAdvanceDefect, stations, chatThreads, activeChatId, renameChat, kolaDemo, kolaTypewriterDone, registerKolaTicket } = useApp()
  const navigate = useNavigate()
  const [view, setView] = useState('list')
  const [values, setValues] = useState(() =>
    Object.fromEntries(DEFECT_FIELDS.map((field) => [field.key, field.value])),
  )
  const [polishing, setPolishing] = useState({})
  const polishTimersRef = useRef({})
  // 已填入的润色文案：输入与其一致时隐藏卡片，再次修改后重新出现
  const [filled, setFilled] = useState({})
  // 润色字段的用户手动编辑标记：预填/打字机填入不算修改，只有改过才显示 AI 润色建议
  const [touched, setTouched] = useState({})
  // 柯拉演示打字机的独立取值：打字期间渲染以它为准，全部打完一次性落进 values 供提交
  const [kolaValues, setKolaValues] = useState(null)

  // 对话指令「新建缺陷单」：打开空白表单等待；fill 态把缺陷描述直接填入「缺陷原因」输入框
  useEffect(() => {
    if (!defectFormRequest) return
    if (defectFormRequest.stage === 'typewriter' || defectFormRequest.stage === 'submit') return
    setView('form')
    if (defectFormRequest.stage === 'awaiting') {
      setKolaValues(null)
      setValues(Object.fromEntries(DEFECT_FIELDS.map((field) => [field.key, ''])))
      setFilled({})
      setTouched({})
      return
    }
    if (defectFormRequest.stage === 'fill') {
      // AI 解析故障描述后补全整张缺陷单：「缺陷原因」用用户描述，其余字段填入 AI 生成内容
      setKolaValues(null)
      setValues(
        Object.fromEntries(
          DEFECT_FIELDS.map((field) => [field.key, field.key === '缺陷原因' ? defectFormRequest.text : field.value]),
        ),
      )
      clearDefectFormRequest()
    }
  }, [defectFormRequest, clearDefectFormRequest])

  // 柯拉一期演示：typewriter 态按字段顺序逐字预填缺陷单（独立 kolaValues，打完一次性落 values），
  // 完成后通知演示状态机解除等待
  useEffect(() => {
    if (defectFormRequest?.stage !== 'typewriter') return undefined
    setView('form')
    setFilled({})
    setTouched({})
    setKolaValues(Object.fromEntries(KOLA_DEFECT_FIELDS.map((field) => [field.key, ''])))
    let fieldIndex = 0
    let charIndex = 0
    const timer = window.setInterval(() => {
      const field = KOLA_DEFECT_FIELDS[fieldIndex]
      if (!field) {
        window.clearInterval(timer)
        // 全部打完：一次性落进 values 并退出打字取值，提交走标准 values 链路
        setValues(Object.fromEntries(KOLA_DEFECT_FIELDS.map((item) => [item.key, String(item.value ?? '')])))
        setKolaValues(null)
        clearDefectFormRequest()
        kolaTypewriterDone?.()
        return
      }
      charIndex += 1
      const value = String(field.value ?? '')
      const typed = value.slice(0, charIndex)
      setKolaValues((current) => (current ? { ...current, [field.key]: typed } : current))
      if (charIndex >= value.length) {
        fieldIndex += 1
        charIndex = 0
      }
    }, 36)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defectFormRequest, clearDefectFormRequest, kolaTypewriterDone])

  // 柯拉一期演示：submit 态直接提交当前已预填的缺陷单
  useEffect(() => {
    if (defectFormRequest?.stage !== 'submit') return
    clearDefectFormRequest()
    submitDefect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defectFormRequest])

  // 统一更新入口：打字期间写入 kolaValues，常规编辑写 values；润色字段修改后防抖触发重新转写
  const setFieldValue = (key, value) => {
    if (kolaValues) setKolaValues((current) => (current ? { ...current, [key]: value } : current))
    else setValues((current) => ({ ...current, [key]: value }))
    if (!POLISH_GENERATORS[key]) return
    setTouched((current) => ({ ...current, [key]: true }))
    setPolishing((current) => ({ ...current, [key]: true }))
    window.clearTimeout(polishTimersRef.current[key])
    polishTimersRef.current[key] = window.setTimeout(() => {
      setPolishing((current) => ({ ...current, [key]: false }))
      polishTimersRef.current[key] = null
    }, 500)
  }

  // 一键填入 AI 润色文案，填入后卡片隐藏
  const applyPolish = (key) => {
    const text = POLISH_GENERATORS[key]?.(values[key])
    if (!text) return
    setValues((current) => ({ ...current, [key]: text }))
    setFilled((current) => ({ ...current, [key]: text }))
  }

  // 提交：胶囊流程下工单与会话联动（会话改名代表工单，关单才进待办）；手工填单维持原逻辑
  // 柯拉一期演示流程：登记演示工单、跳过自动流转（由空格逐步推进），提交后回到任务中心看对话流转
  const submitDefect = () => {
    const station = stations?.find((item) => values['厂站']?.includes(item.name)) || stations?.[0]
    const level = String(values['缺陷类别'] || '').match(/^(IV|I{1,3})/)?.[1]
    // 会话标题命中「新建xx缺陷单」即为对话胶囊发起的流程
    const activeThread = chatThreads?.find((item) => item.id === activeChatId)
    const capsuleKeyword = activeThread?.title?.match(/^新建(.+)缺陷单$/)?.[1]
    const created = createTask?.({
      type: 'defect',
      title: `${station?.shortName ?? '流域电站'} ${values['设备描述'] || '设备'}·${values['故障类别'] || '缺陷'}`,
      stationId: station?.id,
      deviceId: values['设备码'] || null,
      severity: SEVERITY_BY_LEVEL[level] || '高',
      // 标准流程第 4 步，合并流程下自动换算为第 2 步「缺陷确认」
      currentStep: 4,
      status: '待运维值班员确认',
      assignee: '运维值班员',
      description: values['缺陷原因'] || values['辅助现象'] || '缺陷单已提交，待运维值班员确认。',
      ...(capsuleKeyword ? { linkedChatId: activeChatId } : {}),
      history: [
        {
          id: `diag-${Date.now()}`,
          step: 1,
          type: 'agent',
          actor: '诊断Agent',
          role: 'diagnosis',
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          title: 'AI 诊断已完成',
          content: values['缺陷原因'] || '缺陷信息已完成 AI 预填，待运维值班员确认。',
          attachments: [],
        },
      ],
    })
    if (created?.id) {
      if (kolaDemo) registerKolaTicket?.(created.id)
      else autoAdvanceDefect?.(created.id)
    }
    // 胶囊流程：会话改名「xx热斑缺陷」后关闭当前表单页回总览，工单流转到关单再推入待办
    if (capsuleKeyword) {
      renameChat?.(activeChatId, `${station?.shortName ?? '流域'}${capsuleKeyword}缺陷`)
      navigate('/')
    }
    if (kolaDemo) navigate('/')
    showToast?.('缺陷单已提交，已转入缺陷确认流程', 'success')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitDefect()
  }

  const handleSave = () => {
    showToast?.('缺陷单内容已保存', 'success')
  }

  // 打字期间表单取值以 kolaValues 为准，打完提交后回到 values
  const formValues = kolaValues ?? values

  return (
    <div className="defect-page is-qa-collapsed">
      <header className="ticket-page__header defect-page__header">
        <div className="ticket-page__identity">
          <div className="ticket-page__title-row">
            {view === 'form' && (
              <button
                className="defect-page__back"
                type="button"
                onClick={() => setView('list')}
                aria-label="返回缺陷单列表"
                title="返回缺陷单列表"
              >
                <CaretLeft size={17} />
              </button>
            )}
            <h1>{view === 'list' ? '缺陷管理' : '新建缺陷单'}</h1>
          </div>
        </div>
        {view === 'list' && (
          <button
            className="defect-page__add"
            type="button"
            onClick={() => setView('form')}
            aria-label="新建缺陷单"
            title="新建缺陷单"
          >
            <Plus size={17} weight="bold" />
          </button>
        )}
      </header>

      {view === 'list' && (
        <div className="defect-page__body">
          <table className="defect-list">
            <thead>
              <tr>
                <th>缺陷编号</th>
                <th>缺陷描述</th>
                <th>缺陷类别</th>
                <th>故障类别</th>
                <th>状态</th>
                <th>厂站</th>
                <th>发现日期</th>
                <th>发现人</th>
              </tr>
            </thead>
            <tbody>
              {DEFECT_LIST.map((item) => (
                <tr key={item.id}>
                  <td className="defect-list__id">{item.id}</td>
                  <td>{item.desc}</td>
                  <td><span className={`defect-list__tag is-${item.levelTone}`}>{item.level}</span></td>
                  <td>{item.category}</td>
                  <td><span className={`defect-list__tag is-${item.statusTone}`}>{item.status}</span></td>
                  <td>{item.station}</td>
                  <td>{item.date}</td>
                  <td>{item.reporter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'form' && (
      <div className="defect-page__body">
        <form className="defect-page__card" onSubmit={handleSubmit}>
          <div className="ticket-stage-defect-form">
            {DEFECT_FIELDS.map((field) => {
              // 用户手动修改过该字段才显示润色卡；填入后输入与润色文案一致时隐藏，继续修改后重新出现
              const polish = !touched[field.key] || filled[field.key] === formValues[field.key] ? null : POLISH_GENERATORS[field.label]?.(formValues[field.key])
              return (
                <label
                  className={`ticket-stage-doc-field${field.multiline ? ' ticket-stage-defect-form__wide' : ''}`}
                  key={field.key}
                >
                  <span>{field.label}</span>
                  {field.options ? (
                    <select
                      value={formValues[field.key]}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    >
                      {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
                    </select>
                  ) : field.multiline ? (
                    <textarea
                      value={formValues[field.key]}
                      rows={3}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formValues[field.key]}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    />
                  )}
                  {polish ? (
                    <div className={`ai-polish-card${polishing[field.key] ? ' is-polishing' : ''}`}>
                      <div className="ai-polish-card__head">
                        <Sparkles size={14} aria-hidden="true" />
                        <span>AI 润色建议</span>
                        {polishing[field.key] ? <span className="ai-polish-card__loading">转写中…</span> : null}
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyPolish(field.key)}>填入</button>
                      </div>
                      <p>{polish}</p>
                    </div>
                  ) : null}
                </label>
              )
            })}
          </div>
          <div className="ticket-stage-defect-form__actions">
            <button className="button-secondary" type="button" onClick={handleSave}>保存</button>
            <button className="button-primary" type="submit"><Check size={15} />提交</button>
          </div>
        </form>
      </div>
      )}
    </div>
  )
}
