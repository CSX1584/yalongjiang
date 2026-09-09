import { useState } from 'react'
import { Check, CaretDown, Sparkle } from '@phosphor-icons/react'

export function TicketProcess({ title, note, children }) {
  const [visited, setVisited] = useState(false)
  return (
    <li className="ticket-lui__process">
      <span className="ticket-lui__node" aria-hidden="true"><Check size={12} /></span>
      <details onToggle={(event) => { if (event.currentTarget.open) setVisited(true) }}>
        <summary>
          <span>{title}</span>
          {note && <small>{note}</small>}
          <CaretDown size={12} aria-hidden="true" />
        </summary>
        {visited && <div className="ticket-lui__evidence">{children}</div>}
      </details>
    </li>
  )
}

export function TicketResult({ title, action, actions, children }) {
  return (
    <li className="ticket-lui__result">
      <span className="ticket-lui__node" aria-hidden="true"><Sparkle size={16} /></span>
      <section aria-label={title}>
        <header className="ticket-lui__heading"><h3>{title}</h3>{action}</header>
        <div className="ticket-lui__answer">{children}</div>
        {actions && <div className="ticket-lui__actions">{actions}</div>}
      </section>
    </li>
  )
}
