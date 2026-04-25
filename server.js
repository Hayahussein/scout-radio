require('dotenv').config()

const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const multer = require('multer')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret'
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '2h'

const MEMBER_USERNAME = process.env.MEMBER_USERNAME || 'scout'
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || 'scout123'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
}

const upload = multer({
  dest: uploadsDir
})

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'scout_radio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

let radioState = {
  audioId: null,
  audioUrl: null,
  audioName: null,
  adminFirstPlayDone: false,
  waitingOpen: false,
  radioOpen: false
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  })
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' })
  }

  next()
}

async function getRecentMessages() {
  const [rows] = await pool.query(
    `SELECT display_name AS name,
            message AS text,
            is_system AS \`system\`,
            DATE_FORMAT(created_at, '%H:%i') AS time
     FROM chat_messages
     ORDER BY id DESC
     LIMIT 80`
  )

  return rows.reverse()
}

async function hydrateAudioState() {
  const [rows] = await pool.query(
    `SELECT id, original_name, file_path, first_play_done
     FROM audio_files
     ORDER BY id DESC
     LIMIT 1`
  )

  if (rows.length > 0) {
    const latest = rows[0]

    radioState.audioId = latest.id
    radioState.audioName = latest.original_name
    radioState.audioUrl = latest.file_path
      ? `/uploads/${path.basename(latest.file_path)}`
      : null
    radioState.adminFirstPlayDone = Boolean(latest.first_play_done)
  }

  const messages = await getRecentMessages()

  io.emit('state:update', radioState)
  io.emit('chat:history', messages)
}

async function saveSystemMessage(text) {
  await pool.query(
    `INSERT INTO chat_messages (display_name, message, is_system)
     VALUES (?, ?, ?)`,
    ['System', text, 1]
  )

  const messages = await getRecentMessages()
  io.emit('chat:history', messages)
}

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = signToken({
        role: 'admin',
        username: ADMIN_USERNAME
      })

      return res.json({
        token,
        role: 'admin',
        profileComplete: true
      })
    }

    if (username === MEMBER_USERNAME && password === MEMBER_PASSWORD) {
      const token = signToken({
        role: 'member',
        profileComplete: false
      })

      return res.json({
        token,
        role: 'member',
        profileComplete: false
      })
    }

    return res.status(401).json({
      error: 'Invalid username or password'
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Login failed'
    })
  }
})

app.get('/api/me', verifyToken, (req, res) => {
  res.json(req.user)
})

app.post('/api/member/profile', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({
        error: 'Members only'
      })
    }

    const { district, groupName, unite, patrouille, teamId } = req.body

    if (!district || !groupName || !unite || !patrouille) {
      return res.status(400).json({
        error: 'All fields are required'
      })
    }

    const [result] = await pool.query(
      `INSERT INTO participants
       (district, group_name, unite, patrouille, team_id)
       VALUES (?, ?, ?, ?, ?)`,
      [district, groupName, unite, patrouille, teamId || null]
    )

    const token = signToken({
      role: 'member',
      profileComplete: true,
      participantId: result.insertId,
      patrouille,
      teamId: teamId || null
    })

    res.json({
      token,
      role: 'member',
      profileComplete: true,
      participantId: result.insertId,
      patrouille,
      teamId: teamId || null
    })
  } catch (error) {
    console.error('Save member profile error:', error)
    res.status(500).json({
      error: 'Could not save member information'
    })
  }
})

app.get('/api/scout-tree', async (req, res) => {
  try {
    const response = await fetch(
      'https://stg.inscription-api.scoutsduliban.org/api/Districts/Tree?branchName=eclaireuses',
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr'
        }
      }
    )

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to load scout tree'
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Scout tree error:', error)
    res.status(500).json({
      error: 'Failed to fetch scout tree'
    })
  }
})

app.get('/api/scout-teams', async (req, res) => {
  try {
    const { UnitId } = req.query

    if (!UnitId) {
      return res.status(400).json({
        error: 'UnitId is required'
      })
    }

    const response = await fetch(
      `https://stg.inscription-api.scoutsduliban.org/api/Teams?UnitId=${encodeURIComponent(UnitId)}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr'
        }
      }
    )

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to load teams'
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Scout teams error:', error)
    res.status(500).json({
      error: 'Failed to fetch teams'
    })
  }
})

app.get('/api/state', verifyToken, async (req, res) => {
  res.json(radioState)
})

app.post('/api/admin/upload-audio', verifyToken, requireAdmin, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file uploaded'
      })
    }

    const originalName = req.file.originalname
    const filePath = req.file.path
    const audioUrl = `/uploads/${path.basename(filePath)}`

    const [result] = await pool.query(
      `INSERT INTO audio_files (original_name, file_path, first_play_done)
       VALUES (?, ?, ?)`,
      [originalName, filePath, 0]
    )

    radioState.audioId = result.insertId
    radioState.audioName = originalName
    radioState.audioUrl = audioUrl
    radioState.adminFirstPlayDone = false

    await pool.query(`DELETE FROM member_audio_plays WHERE audio_id = ?`, [
      result.insertId
    ])

    io.emit('state:update', radioState)

    res.json({
      success: true,
      audioId: result.insertId,
      audioUrl,
      audioName: originalName
    })
  } catch (error) {
    console.error('Upload audio error:', error)
    res.status(500).json({
      error: 'Could not upload audio'
    })
  }
})

app.post('/api/admin/first-play-done', verifyToken, requireAdmin, async (req, res) => {
  try {
    if (!radioState.audioId) {
      return res.status(400).json({
        error: 'No audio uploaded'
      })
    }

    await pool.query(
      `UPDATE audio_files
       SET first_play_done = 1
       WHERE id = ?`,
      [radioState.audioId]
    )

    radioState.adminFirstPlayDone = true

    io.emit('state:update', radioState)
    io.emit('admin:first-play-done')

    await saveSystemMessage('La première écoute est terminée. Les membres peuvent maintenant réécouter 2 fois.')

    res.json({
      success: true
    })
  } catch (error) {
    console.error('First play done error:', error)
    res.status(500).json({
      error: 'Could not update first play status'
    })
  }
})

app.post('/api/admin/open-waiting', verifyToken, requireAdmin, async (req, res) => {
  try {
    radioState.waitingOpen = true
    radioState.radioOpen = false

    io.emit('state:update', radioState)
    io.emit('admin:open-waiting')

    res.json({
      success: true
    })
  } catch (error) {
    console.error('Open waiting error:', error)
    res.status(500).json({
      error: 'Could not open waiting room'
    })
  }
})

app.post('/api/admin/open-radio', verifyToken, requireAdmin, async (req, res) => {
  try {
    radioState.radioOpen = true
    radioState.waitingOpen = false

    io.emit('state:update', radioState)
    io.emit('admin:open-radio')

    res.json({
      success: true
    })
  } catch (error) {
    console.error('Open radio error:', error)
    res.status(500).json({
      error: 'Could not open radio page'
    })
  }
})

app.post('/api/member/audio-play', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({
        error: 'Members only'
      })
    }

    if (!radioState.audioId) {
      return res.status(400).json({
        error: 'No audio available'
      })
    }

    if (!radioState.adminFirstPlayDone) {
      return res.status(403).json({
        error: 'Members can replay only after admin first play'
      })
    }

    const participantId = req.user.participantId

    if (!participantId) {
      return res.status(400).json({
        error: 'Missing participant profile'
      })
    }

    const [existingRows] = await pool.query(
      `SELECT id, play_count
       FROM member_audio_plays
       WHERE participant_id = ? AND audio_id = ?
       LIMIT 1`,
      [participantId, radioState.audioId]
    )

    if (existingRows.length === 0) {
      await pool.query(
        `INSERT INTO member_audio_plays (participant_id, audio_id, play_count)
         VALUES (?, ?, ?)`,
        [participantId, radioState.audioId, 1]
      )

      return res.json({
        success: true,
        playCount: 1,
        remainingPlays: 1
      })
    }

    const currentCount = existingRows[0].play_count

    if (currentCount >= 2) {
      return res.status(403).json({
        error: 'You have used your 2 replays',
        playCount: currentCount,
        remainingPlays: 0
      })
    }

    const newCount = currentCount + 1

    await pool.query(
      `UPDATE member_audio_plays
       SET play_count = ?
       WHERE id = ?`,
      [newCount, existingRows[0].id]
    )

    res.json({
      success: true,
      playCount: newCount,
      remainingPlays: Math.max(0, 2 - newCount)
    })
  } catch (error) {
    console.error('Member audio play error:', error)
    res.status(500).json({
      error: 'Could not register audio play'
    })
  }
})

app.get('/api/member/audio-play-status', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({
        error: 'Members only'
      })
    }

    if (!radioState.audioId || !req.user.participantId) {
      return res.json({
        playCount: 0,
        remainingPlays: 2
      })
    }

    const [rows] = await pool.query(
      `SELECT play_count
       FROM member_audio_plays
       WHERE participant_id = ? AND audio_id = ?
       LIMIT 1`,
      [req.user.participantId, radioState.audioId]
    )

    const playCount = rows.length ? rows[0].play_count : 0

    res.json({
      playCount,
      remainingPlays: Math.max(0, 2 - playCount)
    })
  } catch (error) {
    console.error('Audio play status error:', error)
    res.status(500).json({
      error: 'Could not get audio play status'
    })
  }
})

app.get('/api/chat/messages', verifyToken, async (req, res) => {
  try {
    const messages = await getRecentMessages()
    res.json(messages)
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({
      error: 'Could not load messages'
    })
  }
})

io.on('connection', socket => {
  socket.emit('state:update', radioState)

  getRecentMessages()
    .then(messages => {
      socket.emit('chat:history', messages)
    })
    .catch(error => {
      console.error('Socket chat history error:', error)
    })

  socket.on('chat:message', async payload => {
    try {
      const token = payload?.token
      const message = payload?.message

      if (!token || !message || !message.trim()) {
        return
      }

      const user = jwt.verify(token, JWT_SECRET)

      const displayName =
        user.role === 'admin'
          ? 'Admin'
          : user.patrouille || 'Member'

      await pool.query(
        `INSERT INTO chat_messages (display_name, message, is_system)
         VALUES (?, ?, ?)`,
        [displayName, message.trim(), 0]
      )

      const messages = await getRecentMessages()
      io.emit('chat:history', messages)
    } catch (error) {
      console.error('Socket chat message error:', error)
    }
  })

  socket.on('admin:open-radio', () => {
    radioState.radioOpen = true
    radioState.waitingOpen = false
    io.emit('state:update', radioState)
    io.emit('admin:open-radio')
  })

  socket.on('admin:open-waiting', () => {
    radioState.waitingOpen = true
    radioState.radioOpen = false
    io.emit('state:update', radioState)
    io.emit('admin:open-waiting')
  })

  socket.on('admin:play-audio', payload => {
    io.emit('admin:play-audio', payload || {})
  })

  socket.on('admin:pause-audio', () => {
    io.emit('admin:pause-audio')
  })

  socket.on('admin:first-play-done', () => {
    radioState.adminFirstPlayDone = true
    io.emit('state:update', radioState)
    io.emit('admin:first-play-done')
  })
})

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(express.static(path.join(__dirname, 'client', 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'))
})

server.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1')
    console.log(`Server running on http://localhost:${PORT}`)
    console.log('Connected to MySQL successfully')

    await hydrateAudioState()
  } catch (error) {
    console.error('Failed to connect to MySQL:', error)
  }
})