import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretUp, Paperclip, PaperPlaneTilt as Send } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'

// 「缺陷单」模式选中后预填到输入框的故障信息示例
export const DEFECT_INFO_SAMPLE = '#3 方阵 7 号组串光伏组件出现热斑，红外测温温差 38℃，组串电流偏低 23%，初步判断为直流接头接触电阻升高'

// 演示用模型选项
const MODEL_OPTIONS = ['deepseek v4', 'deepseek v3']

// 输入框内常驻模式按钮的上拉选项：缺陷单/报告分析走现有指令流程，其余仅切换模式胶囊
// GUI 模式的「+」菜单复用同一份选项定义
export const COMPOSER_MODES = [
  { key: 'general', menu: '通用事项', label: '通用事项' },
  { key: 'defect', menu: '缺陷单', label: '新建缺陷单' },
  { key: 'report', menu: '报告分析', label: '巡检报告' },
  { key: 'task', menu: '巡检任务', label: '巡检任务' },
]

/**
 * 输入框内底部工具行：左侧附件图标 + 常驻模式按钮（点击上拉选择模式），右侧模型选择 + 发送按钮
 * 缺陷单：请求空表单进入等待填入态并预填故障信息（发送时才跳转，避免侧栏输入框被卸载）
 * 报告分析：打开巡检报告列表（工作台上下文，左侧导航与输入框保留）并预填指令
 */
export default function ComposerToolbar({ setDraft, sendDisabled, onSend }) {
  const navigate = useNavigate()
  const { requestDefectForm, setInspectionStage, showToast } = useApp()
  const [model, setModel] = useState(MODEL_OPTIONS[0])
  const [menuOpen, setMenuOpen] = useState(false)
  // 默认选中「通用事项」模式
  const [modeKey, setModeKey] = useState('general')

  const active = COMPOSER_MODES.find((mode) => mode.key === modeKey)

  const pickMode = (mode) => {
    setModeKey(mode.key)
    setMenuOpen(false)
    if (mode.key === 'defect') {
      requestDefectForm()
      setDraft(DEFECT_INFO_SAMPLE)
      return
    }
    if (mode.key === 'report') {
      setInspectionStage('list')
      // fromWorkbench 标记：左侧导航与输入框保留，顶部导航保持 AI工作台高亮
      navigate('/inspection', { state: { fromWorkbench: true } })
      setDraft('巡检报告分析')
      return
    }
    if (mode.key === 'task') {
      // 发送时才跳转巡检任务详情页，避免侧栏输入框被卸载
      setDraft('新建巡检任务')
    }
  }

  return (
    <div className="composer-toolbar">
      <button
        className="composer-toolbar__icon"
        type="button"
        onClick={() => showToast?.('演示环境暂未开放附件上传', 'info')}
        aria-label="添加附件"
        title="添加附件"
      >
        <Paperclip size={15} />
      </button>
      <span className="composer-mode">
        {menuOpen ? (
          <>
            <span className="composer-mode__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <span className="composer-mode__menu" role="menu">
              {COMPOSER_MODES.map((mode) => (
                <button
                  key={mode.key}
                  className={modeKey === mode.key ? 'is-active' : ''}
                  type="button"
                  role="menuitem"
                  onClick={() => pickMode(mode)}
                >
                  {mode.menu}
                </button>
              ))}
            </span>
          </>
        ) : null}
        <button
          className={`composer-mode__trigger${active ? ' is-active' : ''}`}
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span>{active?.label ?? '通用事项'}</span>
          <CaretUp className={`composer-mode__chevron${menuOpen ? ' is-open' : ''}`} size={11} aria-hidden="true" />
        </button>
      </span>
      <span className="composer-toolbar__spacer" />
      <select
        className="composer-toolbar__model"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        aria-label="模型选择"
        title="模型选择"
      >
        {MODEL_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button
        className="ticket-composer__send"
        type="button"
        disabled={sendDisabled}
        onClick={onSend}
        aria-label="发送"
        title="发送"
      >
        <Send size={17} />
      </button>
    </div>
  )
}
