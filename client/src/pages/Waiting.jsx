import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import socket, { connectSocket } from '../socket.js'
import { apiFetch } from '../auth.js'


const TARGET = new Date('2026-04-28T18:35:00').getTime()

function pad(n) {
  return String(n).padStart(2, '0')
}

function getTimeLeft() {
  const diff = TARGET - Date.now()
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 }

  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  }
}

export default function Waiting({ user }) {
  const [time, setTime] = useState(getTimeLeft())
  const [goingLive, setGoingLive] = useState(false)
  const navigate = useNavigate()

  function goToRadio() {
    socket.off()
    socket.disconnect()
    navigate('/radio', { replace: true })
  }

  function triggerOpen() {
    if (goingLive) return

    setGoingLive(true)

    setTimeout(() => {
      goToRadio()
    }, 2000)
  }

  useEffect(() => {
    let mounted = true

    connectSocket()

    socket.on('admin:open-radio', () => {
      console.log('🔥 Ouverture de la radio reçue via socket')
      triggerOpen()
    })

    async function checkStatus() {
      try {
        const res = await apiFetch('/api/state')
        const data = await res.json()

        if (data.radioOpen && mounted) {
          triggerOpen()
        }
      } catch (err) {
        console.log('Erreur lors de la vérification du statut :', err)
      }
    }

    checkStatus()
    const poll = setInterval(checkStatus, 3000)

    const interval = setInterval(() => {
      if (!mounted) return
      setTime(getTimeLeft())
    }, 1000)

    return () => {
      mounted = false
      clearInterval(interval)
      clearInterval(poll)
      socket.off('admin:open-radio')
      socket.disconnect()
    }
  }, [])

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        <h1 style={s.h1}>
          Rendez-vous le <span style={{ color: '#38bdf8' }}>28 avril</span>
        </h1>

        <p style={s.subtitle}>La diffusion commencera à</p>

        <p style={s.dateLine}>
          <span style={{ color: '#38bdf8' }}>18:35</span>
        </p>

        <div style={s.countdown}>
          {[
            { val: time.d, label: 'Jours' },
            { val: time.h, label: 'Heures' },
            { val: time.m, label: 'Min' },
            { val: time.s, label: 'Sec' },
          ].map((u, i) => (
            <React.Fragment key={u.label}>
              {i > 0 && <div style={s.sep}>:</div>}

              <div style={s.unit}>
                <div style={s.numBox}>{pad(u.val)}</div>
                <div style={s.unitLabel}>{u.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {!goingLive && (
          <p style={s.hint}>
            En attente de l’ouverture de la radio par l’opérateur...
          </p>
        )}

        {goingLive && (
          <div style={s.goingLive}>
            🎙 Ouverture de la radio...
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    padding: '1rem'
  },
  wrap: {
    textAlign: 'center'
  },
  h1: {
    fontSize: 28,
    color: '#fff'
  },
  subtitle: {
    color: '#666'
  },
  dateLine: {
    fontSize: 18,
    color: '#fff',
    marginBottom: '2rem'
  },
  countdown: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    marginBottom: '2rem'
  },
  unit: {
    textAlign: 'center'
  },
  numBox: {
    width: 70,
    height: 70,
    background: '#1a1a1a',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: '#fff',
    fontFamily: 'monospace'
  },
  unitLabel: {
    fontSize: 11,
    color: '#555'
  },
  sep: {
    fontSize: 24,
    color: '#333',
    marginTop: 20
  },
  hint: {
    color: '#666',
    marginTop: '1rem'
  },
  goingLive: {
    marginTop: '1rem',
    color: '#4ade80',
    background: 'rgba(74,222,128,0.08)',
    padding: '10px 16px',
    borderRadius: 10,
    display: 'inline-block'
  }
}