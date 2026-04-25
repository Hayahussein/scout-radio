import { io } from 'socket.io-client'
import { getToken } from './auth.js'

const socket = io({
  autoConnect: false,
  path: '/socket.io',
})

export function connectSocket() {
  socket.auth = { token: getToken() }
  if (!socket.connected) socket.connect()
}

export default socket
