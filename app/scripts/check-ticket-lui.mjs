import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['solar-plant-monitor-embed'] } })
try {
  const { TicketProcess, TicketResult } = await server.ssrLoadModule('/src/components/TicketLuiTimeline.jsx')
  const html = renderToStaticMarkup(h('ol', null,
    h(TicketProcess, { title: '数据收集', note: '6 类图表' }, h('div', null, 'heavy chart')),
    h(TicketResult, { title: '诊断结论', actions: h('button', null, '确认') }, '结论正文'),
  ))
  assert.match(html, /<details/)
  assert.doesNotMatch(html, /<details[^>]*\sopen/)
  assert.match(html, /<summary/)
  assert.doesNotMatch(html, /heavy chart/, '折叠的重型图表应在首次展开后挂载')
  assert.match(html, /结论正文/)
  assert.match(html, /<button>确认<\/button>/)
  const { ApprovalPanel } = await server.ssrLoadModule('/src/components/ApprovalPanel.jsx')
  const step = { id: 'permit-approval', advanceMode: 'approval', approverRole: 'control', approverRoles: ['control', 'operations'] }
  const panel = (ticket, options = {}) => renderToStaticMarkup(h(ApprovalPanel, { step, ticket, role: 'admin', ...options }))
  const first = panel({ operationPermitEnabled: true })
  assert.match(first, /批准工作票/)
  assert.doesNotMatch(first, /批准操作票/, '先批工作票，再批操作票')
  const second = panel({ operationPermitEnabled: true, permitSignoffs: { control: true } })
  assert.match(second, /批准操作票/)
  const historical = panel({ operationPermitEnabled: true }, { disabled: true })
  assert.ok([...historical.matchAll(/<button\b[^>]*>/g)].every(([button]) => button.includes('disabled')), '历史页签不能操作当前流程')
  assert.equal(panel({ operationPermitEnabled: false, permitSignoffs: { control: true } }), '', '无操作票时不要求第二次会签')
  const { TicketStageContent } = await server.ssrLoadModule('/src/components/TicketStageContent.jsx')
  const { AppProvider } = await server.ssrLoadModule('/src/context/AppContext.jsx')
  const { initialTickets, flowStepsV2 } = await server.ssrLoadModule('/src/data/demoData.js')
  const tickets = initialTickets.filter(({ id }) => /^DF-20260820-00[123]$/.test(id))
  assert.equal(tickets.length, 3)
  assert.equal(flowStepsV2.length, 8)
  for (const ticket of tickets) {
    for (const [offset, flowStep] of flowStepsV2.entries()) {
      const markup = renderToStaticMarkup(h(AppProvider, null, h(TicketStageContent, {
        ticket, step: { ...flowStep, index: offset + 1 }, currentStep: offset + 1, completed: true, presentation: 'lui',
      })))
      assert.match(markup, /ticket-lui__process/, `${ticket.id} / ${flowStep.name} 需有可展开过程`)
      assert.match(markup, /ticket-lui__result/, `${ticket.id} / ${flowStep.name} 需有直接可见的结果`)
      assert.doesNotMatch(markup, /<details[^>]*\sopen/)
      if (flowStep.id === 'diagnose') {
        assert.equal((markup.match(/chat-defect-card__choice-head/g) ?? []).length, 4, '保留 A/B/C/D 四项动作')
        if (ticket.id.endsWith('001')) assert.match(markup, /第 7 组串接触电阻升高，已形成持续性热斑/)
        if (ticket.id.endsWith('003')) assert.match(markup, /逆变器交流接触器触点抖动/)
      }
    }
  }
  console.log('PASS: 三张单 × 八个页签、默认折叠、结论可见、A/B/C/D、历史禁用及顺序会签')
} finally {
  await server.close()
}
