import React, { useState, useEffect, useRef } from 'react'

const AV_COLORS = [
  { bg: 'rgba(56,189,248,.15)', color: '#38bdf8' },
  { bg: 'rgba(167,139,250,.15)', color: '#a78bfa' },
  { bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  { bg: 'rgba(244,114,182,.15)', color: '#f472b6' },
]

function getColor(name, map) {
  if (!map[name]) {
    const idx = Object.keys(map).length % AV_COLORS.length
    map[name] = AV_COLORS[idx]
  }
  return map[name]
}

export default function Chat({ messages, user, colorMap, onSend }) {
  const [text, setText] = useState('')
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <div style={s.onlineDot}/> Live chat
      </div>
      <div style={s.msgs}>
        {messages.map((msg, i) => {
          if (msg.system) return <div key={i} style={s.sys}>{msg.text}</div>
          const mine = msg.name === user
          const col = getColor(msg.name, colorMap)
          return (
            <div key={i} style={{ ...s.row, flexDirection: mine ? 'row-reverse' : 'row' }}>
              <div style={{ ...s.av, background: col.bg, color: col.color }}>
                {msg.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ ...s.nameTime, textAlign: mine ? 'right' : 'left' }}>
                  {msg.name} · {msg.time}
                </div>
                <div style={mine ? s.bubbleMine : s.bubbleOther}>{msg.text}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={s.inputRow}>
        <input style={s.input} type="text" placeholder="Say something..."
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}/>
        <button style={s.sendBtn} onClick={send}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8L14 3l-5 12-2-4-5-3z" fill="white"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap: { background: '#1a1a1a', border: '1px solid #252525', borderRadius: 14, overflow: 'hidden', marginBottom: '1rem' },
  head: { padding: '.75rem 1.25rem', borderBottom: '1px solid #252525', fontSize: 14, fontWeight: 500, color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 8 },
  onlineDot: { width: 7, height: 7, borderRadius: '50%', background: '#4ade80' },
  msgs: { height: 260, overflowY: 'auto', padding: '.75rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 },
  sys: { textAlign: 'center', fontSize: 11, color: '#444', padding: '2px 0' },
  row: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  av: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 },
  nameTime: { fontSize: 10, color: '#444', marginBottom: 2 },
  bubbleOther: { maxWidth: '75%', padding: '7px 11px', borderRadius: 12, borderTopLeftRadius: 3, fontSize: 13, lineHeight: 1.5, background: '#222', color: '#f0f0f0' },
  bubbleMine: { maxWidth: '75%', padding: '7px 11px', borderRadius: 12, borderTopRightRadius: 3, fontSize: 13, lineHeight: 1.5, background: 'linear-gradient(135deg,#0c4a6e,#312e81)', color: '#bae6fd' },
  inputRow: { display: 'flex', gap: 8, padding: '.75rem 1rem', borderTop: '1px solid #252525' },
  input: { flex: 1, padding: '9px 14px', border: '1px solid #2a2a2a', borderRadius: 20, background: '#111', color: '#f0f0f0', fontSize: 14, outline: 'none' },
  sendBtn: { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' },
}