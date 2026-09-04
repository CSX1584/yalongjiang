import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretLeft, Check } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { fieldsFromRows } from '../components/TicketStageContent'
import { Button } from '@heroui/react'

// 工单输入项：与 AI工作台工单编辑弹窗（两河口热斑消缺工单）字段完全一致
const WORK_ORDER_ROWS = [
  ['工单编号', 'GD-20260813-017'], ['状态', '待提交'], ['工单类型', '消缺工单'], ['时间窗口', '2026-08-20'],
  ['创建人', '运维值班员 王磊'], ['创建时间', '2026-08-13 16:05'], ['场站', '两河口光储电站'], ['班组', '川西检修一组'],
  ['工作负责人', '李强'], ['工作内容', '更换 3 块热斑组件并复紧直流侧连接件，完成 IV 曲线与红外复测'],
  ['设备编号', 'LHK-PV-03-07'], ['设备名称', '#3 方阵 7 号组串光伏组件'], ['KKS 编码', 'LHK-PV-03-07-STR07'], ['KKS 描述', '两河口 #3 方阵 7 号组串'],
]

const WORK_ORDER_FIELDS = fieldsFromRows(WORK_ORDER_ROWS)

/**
 * 新建工单页：运维负责人从总览待办卡进入，字段与工单编辑弹窗一致，
 * 进入后按字段顺序逐字打字预填（同新建缺陷单）
 */
export default function WorkOrderPage() {
  const { showToast } = useApp()
  const navigate = useNavigate()
  const [values, setValues] = useState(() =>
    Object.fromEntries(WORK_ORDER_FIELDS.map((field) => [field.key, ''])),
  )

  // 打字机预填：进入页面逐字填入，重进页面重新打一遍
  useEffect(() => {
    let fieldIndex = 0
    let charIndex = 0
    const timer = window.setInterval(() => {
      const field = WORK_ORDER_FIELDS[fieldIndex]
      if (!field) {
        window.clearInterval(timer)
        return
      }
      charIndex += 1
      const value = String(field.value ?? '')
      // 下拉字段没有中间态，一次落终值
      const typed = field.options ? value : value.slice(0, charIndex)
      setValues((current) => ({ ...current, [field.key]: typed }))
      if (charIndex >= value.length) {
        fieldIndex += 1
        charIndex = 0
      }
    }, 36)
    return () => window.clearInterval(timer)
  }, [])

  const setFieldValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="defect-page is-qa-collapsed">
      <header className="ticket-page__header defect-page__header">
        <div className="ticket-page__identity">
          <div className="ticket-page__title-row">
            <button
              className="defect-page__back"
              type="button"
              onClick={() => navigate('/')}
              aria-label="返回总览"
              title="返回总览"
            >
              <CaretLeft size={17} />
            </button>
            <h1>新建工单</h1>
          </div>
        </div>
      </header>

      <div className="defect-page__body">
        <form className="defect-page__card" onSubmit={(event) => event.preventDefault()}>
          <div className="ticket-stage-defect-form">
            {WORK_ORDER_FIELDS.map((field) => (
              <label
                className={`ticket-stage-doc-field${field.multiline ? ' ticket-stage-defect-form__wide' : ''}`}
                key={field.key}
              >
                <span>{field.label}</span>
                {field.options ? (
                  <select
                    value={values[field.key]}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  >
                    {field.options.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                ) : field.multiline ? (
                  <textarea
                    value={values[field.key]}
                    rows={3}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.key]}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="ticket-stage-defect-form__actions">
            <Button className="button-secondary ops-heroui-button" type="button" variant="secondary" size="sm" onPress={() => showToast?.('工单内容已保存', 'success')}>保存</Button>
            <Button className="button-primary ops-heroui-button" type="button" variant="primary" size="sm" onPress={() => showToast?.('工单已提交，待运维负责人批准', 'success')}><Check size={15} />提交审批</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
