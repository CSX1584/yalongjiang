import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BellRinging, MagnifyingGlass } from '@phosphor-icons/react'
import { useApp } from '../context/AppContext'
import { ALARM_LIST } from '../data/demoData'

const SEVERITY_LABEL = { urgent: '严重', warning: '预警', info: '提示' }

/**
 * 告警管理页：默认全量展示各站告警；演示编排跳入时（state.alarmTyping）
 * 先展示全部告警，按空格后搜索框才逐字打入筛选词，打字完成落 alarm-done 等待空格推进
 */
export default function AlarmPage() {
  const location = useLocation()
  const { kolaAlarmTyped, kolaDemo } = useApp()
  const [keyword, setKeyword] = useState('')
  // 回调经 ref 取用：effect 只依赖演示等待状态，避免 context 函数身份抖动导致打字重启
  const kolaAlarmTypedRef = useRef(kolaAlarmTyped)
  kolaAlarmTypedRef.current = kolaAlarmTyped

  const typingText = location.state?.alarmTyping
  const typingActive = kolaDemo?.waiting === 'alarm-typing'
  // 打字完成后保持筛选结果，后续步骤推进（waiting 变化）不清空搜索框
  const typedRef = useRef(false)

  // 演示跳入告警页：先全量展示；空格把 waiting 切到 alarm-typing 后才逐字打字，
  // 打完回调演示状态机（落 alarm-done，再按空格推进下一步）
  useEffect(() => {
    if (!typingText) return undefined
    if (!typingActive) {
      if (!typedRef.current) setKeyword('')
      return undefined
    }
    setKeyword('')
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setKeyword(typingText.slice(0, index))
      if (index >= typingText.length) {
        window.clearInterval(timer)
        typedRef.current = true
        kolaAlarmTypedRef.current?.()
      }
    }, 180)
    return () => window.clearInterval(timer)
  }, [typingText, typingActive])

  const filtered = useMemo(() => {
    const text = keyword.trim()
    if (!text) return ALARM_LIST
    return ALARM_LIST.filter((item) =>
      [item.station, item.device, item.title, item.status].some((field) => field.includes(text)),
    )
  }, [keyword])

  return (
    <div className="defect-page is-qa-collapsed">
      <header className="ticket-page__header defect-page__header">
        <div className="ticket-page__identity">
          <div className="ticket-page__title-row">
            <h1>告警管理</h1>
          </div>
        </div>
        <label className="alarm-filter">
          <MagnifyingGlass size={15} aria-hidden="true" />
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入电站 / 设备 / 告警名称筛选"
            aria-label="筛选告警"
          />
        </label>
      </header>

      <div className="defect-page__body">
        <div className="alarm-summary">
          <BellRinging size={15} aria-hidden="true" />
          <span>共 {filtered.length} 条告警{keyword.trim() ? `（按「${keyword.trim()}」筛选）` : '（全部电站）'}</span>
        </div>
        <table className="defect-list">
          <thead>
            <tr>
              <th>告警编号</th>
              <th>厂站</th>
              <th>设备</th>
              <th>级别</th>
              <th>告警内容</th>
              <th>时间</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className="defect-list__id">{item.id}</td>
                <td>{item.station}</td>
                <td>{item.device}</td>
                <td><span className={`defect-list__tag is-${item.severity}`}>{SEVERITY_LABEL[item.severity] ?? item.severity}</span></td>
                <td>{item.title}</td>
                <td>{item.time}</td>
                <td>{item.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}>无匹配告警</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
