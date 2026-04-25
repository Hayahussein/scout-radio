import React, { useEffect, useRef, useState } from 'react'
import socket, { connectSocket } from '../socket.js'
import { apiFetch, getToken } from '../auth.js'
import Chat from '../components/Chat.jsx'

export default function AdminPanel({ user, onLogout }) {
  const [audioName, setAudioName] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [radioOpen, setRadioOpen] = useState(false)
  const [waitingOpen, setWaitingOpen] = useState(false)
  const [firstPlayDone, setFirstPlayDone] = useState(false)
  const [adminPlaying, setAdminPlaying] = useState(false)

  const [messages, setMessages] = useState([])
  const audioRef = useRef(null)
  const colorMap = useRef({})

  useEffect(() => {
    connectSocket()

    socket.on('state:update', (state) => {
      setAudioName(state.audioName || '')
      setAudioUrl(state.audioUrl || '')
      setRadioOpen(!!state.radioOpen)
      setWaitingOpen(!!state.waitingOpen)
      setFirstPlayDone(!!state.adminFirstPlayDone)
    })

    socket.on('chat:history', (msgs) => {
      setMessages(msgs || [])
    })

    return () => {
      socket.off()
      socket.disconnect()
      audioRef.current?.pause()
    }
  }, [])

  async function post(url, body = {}) {
    return apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async function uploadAudio() {
    if (!selectedFile) {
      alert('Veuillez choisir un fichier audio')
      return
    }

    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('audio', selectedFile)

      const res = await apiFetch('/api/admin/upload-audio', {
        method: 'POST',
        body: fd
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.error || 'Échec du téléchargement')
        return
      }

      setAudioName(data.audioName || selectedFile.name)
      setAudioUrl(data.audioUrl || '')
      setFirstPlayDone(false)
      alert('Audio téléchargé avec succès')
    } catch (err) {
      console.error('Upload error:', err)
      alert('Échec du téléchargement')
    } finally {
      setUploading(false)
    }
  }

  function ensureAdminAudio() {
    if (!audioUrl) {
      alert('Veuillez d’abord télécharger un audio')
      return null
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)

      audioRef.current.addEventListener('ended', () => {
        setAdminPlaying(false)
      })
    }

    return audioRef.current
  }

  function playForAll() {
    const audio = ensureAdminAudio()
    if (!audio) return

    audio.currentTime = 0
    audio.play().catch((err) => {
      console.error('Admin play error:', err)
    })

    setAdminPlaying(true)

    socket.emit('admin:play-audio', {
      audioUrl,
      audioName
    })
  }

  function pauseForAll() {
    audioRef.current?.pause()
    setAdminPlaying(false)

    socket.emit('admin:pause-audio')
  }

  async function markFirstPlayDone() {
    const res = await post('/api/admin/first-play-done')
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.error || 'Impossible de valider la première lecture')
      return
    }

    audioRef.current?.pause()
    setAdminPlaying(false)
    setFirstPlayDone(true)
  }

  async function openRadio() {
    const res = await post('/api/admin/open-radio')
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.error || 'Impossible de faire entrer les scouts')
      return
    }

    setRadioOpen(true)
    setWaitingOpen(false)
  }

  async function openWaiting() {
    const res = await post('/api/admin/open-waiting')
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.error || 'Impossible d’ouvrir la salle d’attente')
      return
    }

    setWaitingOpen(true)
    setRadioOpen(false)
  }

  function sendChat(text) {
    socket.emit('chat:message', {
      token: getToken(),
      message: text
    })
  }

  return (
    <div className="page-shell" style={{ display: 'block' }}>
      <div style={s.topBar}>
        <div style={s.statusWrap}>
          <div style={{ ...s.dot, background: radioOpen ? '#65e6a3' : '#7d89a6' }} />
          <span>{radioOpen ? 'RADIO OUVERTE' : 'RADIO EN ATTENTE'}</span>
        </div>

        <button style={s.btnRed} onClick={onLogout}>
          Quitter
        </button>
      </div>

      <div style={s.container}>
        <div className="card" style={s.card}>
          <div className="brand-mark">RADIO SCOUT</div>
          <h1 style={s.title}>Panneau admin</h1>
          <p className="muted">
            Téléchargez l’audio, lancez la première écoute, puis faites entrer les scouts.
          </p>
        </div>

        <div style={s.grid}>
          <div className="card" style={s.card}>
            <div style={s.sectionLabel}>Fichier audio</div>

            <label style={s.uploadBox}>
              <div style={s.uploadIcon}>🎙</div>

              <p style={{ color: selectedFile ? '#65e6a3' : '#b6bed9' }}>
                {selectedFile ? selectedFile.name : 'Cliquez pour choisir un fichier audio'}
              </p>

              <small style={{ color: '#7d89a6' }}>
                mp3, wav, ogg, m4a
              </small>

              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              type="button"
              style={s.primaryBtn}
              onClick={uploadAudio}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Téléchargement...' : 'Télécharger l’audio'}
            </button>

            {audioName && (
              <div style={s.infoBox}>
                Audio actuel : <b>{audioName}</b>
              </div>
            )}
          </div>

          <div className="card" style={s.card}>
            <div style={s.sectionLabel}>Première lecture</div>

            {!audioUrl && (
              <p style={s.mutedSmall}>
                Veuillez télécharger un audio avant de lancer la diffusion.
              </p>
            )}

            {audioUrl && !firstPlayDone && (
              <>
                {!adminPlaying ? (
                  <button type="button" style={s.primaryBtn} onClick={playForAll}>
                    ▶ Lire pour tous les scouts
                  </button>
                ) : (
                  <button type="button" style={s.warningBtn} onClick={pauseForAll}>
                    ⏸ Pause
                  </button>
                )}

                <button type="button" style={s.successBtn} onClick={markFirstPlayDone}>
                  ✓ Première lecture terminée
                </button>
              </>
            )}

            {firstPlayDone && (
              <div style={s.successBox}>
                ✓ Première lecture terminée. Les scouts peuvent maintenant réécouter 2 fois.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={s.card}>
          <div style={s.sectionLabel}>Contrôle de la salle</div>

          <div style={s.buttonRow}>
            <button type="button" style={s.secondaryBtn} onClick={openWaiting}>
              Ouvrir la salle d’attente
            </button>

            <button type="button" style={s.primaryBtn} onClick={openRadio}>
              Faire entrer les scouts
            </button>
          </div>

          <div style={s.infoBox}>
            Statut : {radioOpen ? 'Radio ouverte' : waitingOpen ? 'Salle d’attente ouverte' : 'En attente'}
          </div>
        </div>

        <div className="card" style={s.card}>
          <div style={s.sectionLabel}>Chat en direct</div>

          <Chat
            messages={messages}
            user="Admin"
            colorMap={colorMap.current}
            onSend={sendChat}
          />
        </div>
      </div>
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
    maxWidth: 1000,
    margin: '0 auto',
    padding: '1.25rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem'
  },
  card: {
    padding: '1.5rem',
    marginBottom: '1rem'
  },
  title: {
    fontSize: 'clamp(2.4rem, 5vw, 4.8rem)'
  },
  sectionLabel: {
    color: '#7d89a6',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.78rem',
    fontWeight: 900,
    marginBottom: '1rem'
  },
  uploadBox: {
    display: 'block',
    border: '1.5px dashed rgba(121, 201, 255, 0.28)',
    borderRadius: 22,
    padding: '1.5rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(5, 15, 34, 0.5)'
  },
  uploadIcon: {
    fontSize: 34,
    marginBottom: 8
  },
  primaryBtn: {
    width: '100%',
    minHeight: 56,
    marginTop: 12,
    borderRadius: 18,
    border: '1px solid rgba(121, 201, 255, 0.7)',
    background: 'linear-gradient(135deg, #8bd4ff 0%, #4ca7ff 45%, #5067ff 100%)',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer'
  },
  secondaryBtn: {
    width: '100%',
    minHeight: 56,
    marginTop: 12,
    borderRadius: 18,
    border: '1px solid rgba(121, 201, 255, 0.35)',
    background: 'rgba(8, 19, 42, 0.75)',
    color: '#79c9ff',
    fontWeight: 900,
    cursor: 'pointer'
  },
  warningBtn: {
    width: '100%',
    minHeight: 56,
    marginTop: 12,
    borderRadius: 18,
    border: '1px solid rgba(247, 215, 116, 0.35)',
    background: 'rgba(247, 215, 116, 0.1)',
    color: '#f7d774',
    fontWeight: 900,
    cursor: 'pointer'
  },
  successBtn: {
    width: '100%',
    minHeight: 52,
    marginTop: 10,
    borderRadius: 18,
    border: '1px solid rgba(101, 230, 163, 0.35)',
    background: 'rgba(101, 230, 163, 0.1)',
    color: '#65e6a3',
    fontWeight: 900,
    cursor: 'pointer'
  },
  buttonRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  infoBox: {
    marginTop: 12,
    padding: '0.9rem 1rem',
    borderRadius: 16,
    color: '#b6bed9',
    background: 'rgba(5, 15, 34, 0.55)',
    border: '1px solid rgba(121, 201, 255, 0.14)',
    fontSize: 14
  },
  successBox: {
    marginTop: 12,
    padding: '0.9rem 1rem',
    borderRadius: 16,
    color: '#65e6a3',
    background: 'rgba(101, 230, 163, 0.08)',
    border: '1px solid rgba(101, 230, 163, 0.22)',
    fontSize: 14
  },
  mutedSmall: {
    color: '#7d89a6',
    fontSize: 14
  }
}