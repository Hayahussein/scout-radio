import React, { useEffect, useRef, useState } from 'react'
import socket, { connectSocket } from '../socket.js'
import { apiFetch, getToken } from '../auth.js'
import Chat from '../components/Chat.jsx'

const FREQS = ['98.6', '101.3', '103.7', '107.1', '94.5']
const freq = FREQS[Math.floor(Math.random() * FREQS.length)]

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function MemberRadio({ user, onLogout }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [audioName, setAudioName] = useState('')
  const [radioOpen, setRadioOpen] = useState(false)
  const [firstPlayDone, setFirstPlayDone] = useState(false)

  const [adminControlling, setAdminControlling] = useState(false)
  const [playing, setPlaying] = useState(false)

  const [playCount, setPlayCount] = useState(0)
  const [remainingPlays, setRemainingPlays] = useState(2)

  const [messages, setMessages] = useState([])
  const [progress, setProgress] = useState(0)
  const [curTime, setCurTime] = useState('0:00')
  const [durTime, setDurTime] = useState('0:00')

  const audioRef = useRef(null)
  const colorMap = useRef({})

  const blocked = remainingPlays <= 0

  function resetAudio(url) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (!url) return

    const a = new Audio(url)

    a.addEventListener('timeupdate', () => {
      if (!a.duration) return
      setProgress((a.currentTime / a.duration) * 100)
      setCurTime(fmtTime(a.currentTime))
    })

    a.addEventListener('loadedmetadata', () => {
      setDurTime(fmtTime(a.duration))
    })

    a.addEventListener('ended', () => {
      setPlaying(false)
      setAdminControlling(false)
    })

    audioRef.current = a
  }

  function ensureAudio() {
    if (!audioUrl) {
      console.log('No audio URL available')
      return null
    }

    if (!audioRef.current) {
      resetAudio(audioUrl)
    }

    return audioRef.current
  }

  async function loadPlayStatus() {
    try {
      const res = await apiFetch('/api/member/audio-play-status')
      const data = await res.json()

      if (res.ok) {
        setPlayCount(data.playCount || 0)
        setRemainingPlays(data.remainingPlays ?? 2)
      }
    } catch (err) {
      console.log('play status error:', err)
    }
  }

  useEffect(() => {
    connectSocket()

    socket.on('state:update', (state) => {
      setAudioName(state.audioName || '')
      setRadioOpen(!!state.radioOpen)
      setFirstPlayDone(!!state.adminFirstPlayDone)

      if (state.audioUrl && state.audioUrl !== audioUrl) {
        setAudioUrl(state.audioUrl)
        resetAudio(state.audioUrl)
      }
    })

    socket.on('chat:history', (msgs) => {
      setMessages(msgs || [])
    })

    socket.on('admin:play-audio', (payload = {}) => {
      const url = payload.audioUrl || audioUrl

      if (!url) {
        console.log('No audio URL from admin')
        return
      }

      setAudioUrl(url)
      setAudioName(payload.audioName || audioName)
      setAdminControlling(true)
      setPlaying(true)
      resetAudio(url)

      setTimeout(() => {
        const audio = audioRef.current

        if (!audio) return

        audio.currentTime = 0
        audio.play().catch((err) => {
          console.log('Member autoplay blocked or failed:', err)
        })
      }, 150)
    })

    socket.on('admin:pause-audio', () => {
      audioRef.current?.pause()
      setPlaying(false)
      setAdminControlling(false)
    })

    socket.on('admin:first-play-done', () => {
      setFirstPlayDone(true)
      setAdminControlling(false)
      setPlaying(false)
      audioRef.current?.pause()
      loadPlayStatus()
    })

    loadPlayStatus()

    return () => {
      socket.off()
      socket.disconnect()
      audioRef.current?.pause()
    }
  }, [])

  async function playMemberAudio() {
    if (!firstPlayDone || blocked || adminControlling) return

    const audio = ensureAudio()
    if (!audio) return

    try {
      const res = await apiFetch('/api/member/audio-play', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || 'Vous ne pouvez plus réécouter cet audio')
        setRemainingPlays(0)
        return
      }

      setPlayCount(data.playCount || 0)
      setRemainingPlays(data.remainingPlays ?? 0)

      audio.currentTime = 0
      await audio.play()
      setPlaying(true)
    } catch (err) {
      console.error('member play error:', err)
      alert('Impossible de lire l’audio')
    }
  }

  function pauseMemberAudio() {
    audioRef.current?.pause()
    setPlaying(false)
  }

  function seek(e) {
    const audio = audioRef.current
    if (!audio?.duration || !firstPlayDone) return

    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration
  }

  function sendChat(text) {
    socket.emit('chat:message', {
      token: getToken(),
      message: text
    })
  }

  function statusText() {
    if (!audioUrl) return 'En attente de l’audio...'
    if (adminControlling) return 'Lecture en cours — l’opérateur radio diffuse en direct'
    if (!firstPlayDone) return 'En attente de la première lecture par l’opérateur...'
    if (blocked) return 'Nombre maximal de réécoutes atteint'
    if (playing) return 'Lecture en cours...'
    return 'Vous pouvez réécouter l’audio'
  }

  return (
    <div className="page-shell" style={{ display: 'block' }}>
      <div style={s.topBar}>
        <div style={s.statusWrap}>
          <div style={{ ...s.dot, background: radioOpen ? '#65e6a3' : '#7d89a6' }} />
          <span>{radioOpen ? 'RADIO OUVERTE' : 'EN ATTENTE'}</span>
        </div>

        <button style={s.btnRed} onClick={onLogout}>
          Quitter
        </button>
      </div>

      <div style={s.container}>
        <div className="card" style={s.radioCard}>
          <div style={s.listenAs}>
            Connecté en tant que <b>{user?.patrouille || 'Patrouille'}</b>
          </div>

          <div style={s.display}>
            <div style={s.displayLabel}>Radio Scout FM</div>

            <div style={s.freq}>
              {audioUrl ? `${freq} FM` : '--- . -'}
            </div>

            <div style={s.statusText}>
              {statusText()}
            </div>

            <div style={s.waveWrap}>
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    ...s.wave,
                    animation: playing ? `wave 1s ease-in-out ${i * 0.08}s infinite` : 'none',
                    height: playing ? undefined : 4
                  }}
                />
              ))}
            </div>
          </div>

          {audioName && (
            <div style={s.audioName}>
              Audio : <b>{audioName}</b>
            </div>
          )}

          <div style={s.progressRow}>
            <span style={s.time}>{curTime}</span>

            <div style={s.progressBar} onClick={seek}>
              <div style={{ ...s.progressFill, width: `${progress}%` }} />
            </div>

            <span style={s.time}>{durTime}</span>
          </div>

          <div style={s.controls}>
            {playing && !adminControlling ? (
              <button style={s.mainButton} onClick={pauseMemberAudio}>
                ⏸ Pause
              </button>
            ) : (
              <button
                style={{
                  ...s.mainButton,
                  opacity: !firstPlayDone || blocked || adminControlling ? 0.45 : 1
                }}
                onClick={playMemberAudio}
                disabled={!firstPlayDone || blocked || adminControlling}
              >
                ▶ Réécouter
              </button>
            )}
          </div>

          <div style={s.replayBadge}>
            Réécoutes utilisées : <b>{playCount}</b> / <b>2</b>
            <br />
            Réécoutes restantes : <b>{remainingPlays}</b>
          </div>

          {adminControlling && (
            <div style={s.infoBlue}>
              🎙 L’opérateur radio diffuse ce message pour tout le monde — écoutez attentivement.
            </div>
          )}

          {firstPlayDone && !blocked && !adminControlling && (
            <div style={s.infoGreen}>
              ✓ Première écoute terminée — vous pouvez maintenant réécouter.
            </div>
          )}

          {blocked && (
            <div style={s.infoRed}>
              Vous avez utilisé toutes vos réécoutes.
            </div>
          )}
        </div>

        <div className="card" style={s.chatCard}>
          <div style={s.sectionLabel}>Chat en direct</div>

          <Chat
            messages={messages}
            user={user?.patrouille || 'Patrouille'}
            colorMap={colorMap.current}
            onSend={sendChat}
          />
        </div>
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { height: 4px; }
          50% { height: 26px; }
        }
      `}</style>
    </div>
  )
}

const s = {
  topBar: {
    width: '100%',
    padding: '0.9rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(8, 19, 42, 0.75)',
    borderBottom: '1px solid rgba(121, 201, 255, 0.14)',
    backdropFilter: 'blur(14px)'
  },
  statusWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#f7f8ff',
    fontSize: 13,
    fontWeight: 800
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%'
  },
  btnRed: {
    padding: '8px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255, 143, 143, 0.34)',
    background: 'rgba(120, 28, 38, 0.3)',
    color: '#ff9d9d',
    fontWeight: 800,
    cursor: 'pointer'
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '1.25rem'
  },
  radioCard: {
    padding: '1.5rem',
    marginBottom: '1rem'
  },
  chatCard: {
    padding: '1.25rem'
  },
  listenAs: {
    color: '#b6bed9',
    fontSize: 14,
    marginBottom: '1rem',
    textAlign: 'center'
  },
  display: {
    background: 'rgba(2, 8, 22, 0.78)',
    border: '1px solid rgba(101, 230, 163, 0.18)',
    borderRadius: 24,
    padding: '1.4rem',
    textAlign: 'center'
  },
  displayLabel: {
    fontSize: 11,
    color: '#65e6a3',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 900
  },
  freq: {
    fontSize: 42,
    fontWeight: 900,
    color: '#65e6a3',
    fontFamily: 'monospace',
    letterSpacing: 4,
    margin: '0.5rem 0'
  },
  statusText: {
    color: '#b6bed9',
    fontSize: 13,
    minHeight: 20
  },
  waveWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    marginTop: 12
  },
  wave: {
    width: 4,
    minHeight: 4,
    borderRadius: 4,
    background: '#65e6a3'
  },
  audioName: {
    marginTop: 12,
    padding: '0.8rem 1rem',
    borderRadius: 16,
    color: '#b6bed9',
    background: 'rgba(5, 15, 34, 0.55)',
    border: '1px solid rgba(121, 201, 255, 0.14)',
    fontSize: 14
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: '1rem'
  },
  time: {
    fontSize: 12,
    color: '#7d89a6',
    fontFamily: 'monospace',
    minWidth: 38
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    cursor: 'pointer',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #79c9ff, #5067ff)',
    borderRadius: 999
  },
  controls: {
    marginTop: '1.2rem',
    display: 'flex',
    justifyContent: 'center'
  },
  mainButton: {
    minHeight: 58,
    width: '100%',
    borderRadius: 20,
    border: '1px solid rgba(121, 201, 255, 0.7)',
    background: 'linear-gradient(135deg, #8bd4ff 0%, #4ca7ff 45%, #5067ff 100%)',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer'
  },
  replayBadge: {
    width: 'fit-content',
    margin: '1rem auto 0',
    padding: '0.45rem 0.9rem',
    borderRadius: 18,
    color: '#b6bed9',
    background: 'rgba(5, 15, 34, 0.65)',
    border: '1px solid rgba(121, 201, 255, 0.14)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 1.6
  },
  infoBlue: {
    marginTop: 12,
    padding: '0.9rem 1rem',
    borderRadius: 16,
    color: '#79c9ff',
    background: 'rgba(121, 201, 255, 0.08)',
    border: '1px solid rgba(121, 201, 255, 0.22)',
    textAlign: 'center',
    fontSize: 14
  },
  infoGreen: {
    marginTop: 12,
    padding: '0.9rem 1rem',
    borderRadius: 16,
    color: '#65e6a3',
    background: 'rgba(101, 230, 163, 0.08)',
    border: '1px solid rgba(101, 230, 163, 0.22)',
    textAlign: 'center',
    fontSize: 14
  },
  infoRed: {
    marginTop: 12,
    padding: '0.9rem 1rem',
    borderRadius: 16,
    color: '#ff9d9d',
    background: 'rgba(255, 143, 143, 0.08)',
    border: '1px solid rgba(255, 143, 143, 0.22)',
    textAlign: 'center',
    fontSize: 14
  },
  sectionLabel: {
    color: '#7d89a6',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.78rem',
    fontWeight: 900,
    marginBottom: '1rem'
  }
}