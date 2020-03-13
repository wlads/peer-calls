import { EventEmitter } from 'events'
import { Socket } from 'socket.io'
import { TypedIO, ServerSocket } from '../shared'
import handleSocket from './socket'
import { MemoryStore, Store } from './store'

describe('server/socket', () => {
  type SocketMock = Socket & {
    id: string
    room?: string
    join: jest.Mock
    leave: jest.Mock
    emit: jest.Mock
  }

  let socket: SocketMock
  let io: TypedIO  & {
    in: jest.Mock<(room: string) => SocketMock>
    to: jest.Mock<(room: string) => SocketMock>
  }
  let rooms: Record<string, {emit: any}>
  beforeEach(() => {
    socket = new EventEmitter() as SocketMock
    socket.id = 'socket0'
    socket.join = jest.fn()
    socket.leave = jest.fn()
    rooms = {}

    io = {} as any
    io.in = io.to = jest.fn().mockImplementation(room => {
      return (rooms[room] = rooms[room] || {
        emit: jest.fn(),
      })
    })

    const sockets = {
      socket0: {
        id: 'socket0',
        userId: 'socket0_userid',
      },
      socket1: {
        id: 'socket1',
        userId: 'socket1_userid',
      },
      socket2: {
        id: 'socket2',
        userId: 'socket2_userid',
      },
    }

    io.sockets = {
      sockets: sockets as any,
      adapter: {
        rooms: {
          room1: {
            socket0: true,
          } as any,
          room2: {
            socket0: true,
          } as any,
          room3: {
            sockets: {
              socket0: true,
              socket1: true,
              socket2: true,
            },
          } as any,
        },
      } as any,
    } as any

    socket.leave = jest.fn()
    socket.join = jest.fn()
  })

  it('should be a function', () => {
    expect(typeof handleSocket).toBe('function')
  })

  describe('socket events', () => {
    let store: Store
    beforeEach(() => {
      store = new MemoryStore()
      handleSocket(socket, io, store)
    })

    describe('signal', () => {
      it('should broadcast signal to specific user', () => {
        store.set('a', 'a-socket-id')
        ;(socket as ServerSocket) .userId = 'b'
        const signal = { type: 'signal' }

        socket.emit('signal', { userId: 'a', signal })

        expect(io.to.mock.calls).toEqual([[ 'a-socket-id' ]])
        expect((io.to('a-socket-id').emit as jest.Mock).mock.calls).toEqual([[
          'signal', {
            userId: 'b',
            signal,
          },
        ]])
      })
    })

    describe('ready', () => {
      it('should call socket.leave if socket.room', () => {
        socket.room = 'room1'
        socket.emit('ready', {
          userId: 'socket0_userid',
          room: 'room2',
        })

        expect(socket.leave.mock.calls).toEqual([[ 'room1' ]])
        expect(socket.join.mock.calls).toEqual([[ 'room2' ]])
      })

      it('should call socket.join to room', () => {
        socket.emit('ready', {
          userId: 'socket0_userid',
          room: 'room3',
        })
        expect(socket.join.mock.calls).toEqual([[ 'room3' ]])
      })

      it('should emit users', () => {
        socket.emit('ready', {
          userId: 'socket0_userid',
          room: 'room3',
        })

        expect(io.to.mock.calls).toEqual([[ 'room3' ]])
        expect((io.to('room3').emit as jest.Mock).mock.calls).toEqual([
          [
            'users', {
              initiator: 'socket0_userid',
              users: [{
                socketId: 'socket0',
                userId: 'socket0_userid',
              }, {
                socketId: 'socket1',
                userId: 'socket1_userid',
              }, {
                socketId: 'socket2',
                userId: 'socket2_userid',
              }],
            },
          ],
        ])
      })
    })
  })
})
