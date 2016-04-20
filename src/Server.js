'use strict'

import url from 'url'
import {STATUS_CODES} from 'http'
import {EventEmitter} from 'events'

import promiseLimit from 'promise-limit'

import {WSServerOptions} from './options'
import WSServerListener from './ServerListener'

export default class WSServer {
  // Construct a new server.
  //
  // Optionally pass an `options` object, to override the defaults provided by
  // ServerOptions.
  constructor (options) {
    this.options = new WSServerOptions(options)

    // Set of WSServerListeners.
    this.listeners = new Set()

    // Set of WSServerClients that are associated with this listener.
    this.clients = new Set()

    // Event emitter. We aren't extending it and using it as a prop instead
    // to mitigate all the headaches that come with variable and method
    // overriding.
    //
    // Aliased a few EventEmitter methods for convenience.
    this.events = new EventEmitter()
    this.on = this.events.on.bind(this.events)
    this.once = this.events.once.bind(this.events)
    this.off = this.events.removeListener.bind(this.events)
    this.offAll = this.events.removeAllListeners.bind(this.events)

    // Aliases, for familiarity's sake.
    this.listen = this.addListener
  }

  // Handles connection upgrades, creating WSServerClient instances.
  // It confirms that the connection is a valid WebSocket connection that we
  // can handle, and calls a function that finishes the WebSocket connection setup.
  //
  // This method can be used by itself, if you prefer to not use listeners.
  //
  // WARNING: If called directly (without a listener), you are responsible for
  // closing the socket, if this function returns a falsy value.
  // Otherwise, the socket will potentially idle for a while,
  // using up one of your free socket connection spots for an unnecessary
  // length of time.
  //
  // Returns a Promise, which
  // * resolves with the WSServerClient instance if
  //   - we can handle this connection upgrade
  // * rejects if
  //   - Upgrade header does not equal 'websocket'
  //   - We're not supposed to handle the path requested (applicable to listeners only)
  //   - TODO
  handleUpgrade (req, socket, _upgradeHead, listener) {
    // Copy the upgrade head.
    // See https://github.com/websockets/ws/blob/0669cae044d1902957acc7c89e1edfcf956f2de8/lib/WebSocketServer.js#L85
    // TODO: Is this really necessary?
    const upgradeHead = new Buffer(_upgradeHead.length)
    _upgradeHead.copy(upgradeHead)

    const closeEarly = (listener && listener.options.get('closeUnknownEarly'))

    if (typeof req.headers.upgrade !== 'string' || req.headers.upgrade.toLowerCase() === 'websocket') {
      if (closeEarly) return abortSocketHandshake(socket, 400, 'Unhandled Upgrade')
      else return
    }

    if (listener) {
      const pathCheckStatus = checkSocketPath(listener, req)
      if (pathCheckStatus === 1) {
        if (closeEarly) return abortSocketHandshake(socket, 404, 'Not Found')
        else return
      } else if (pathCheckStatus === 2) return
    }

    // TODO: handle socket closes and errors
    // TODO: handling the upgrade

    if (listener) listener.clients.add(client)
    this.clients.add(client)
    this.events.emit('connection', client)
    return client
  }

  // Add a listener to the server.
  // Returns a Promise, which
  // * resolves if
  //   - the listener attached successfully (see WSServerListener.attach)
  //     (in which the listener is then associated with the server)
  // * rejects if
  //   - the listener did not attach successfully (see WSServerListener.attach)
  //     (the listener is not added to WSServer.listeners)
  addListener (options) {
    let listener
    return Promise.resolve().then(() => {
      listener = new WSServerListener(options, this)
      return listener.attach()
    }).then(() => {
      this.listeners.add(listener)
      return listener
    })
  }

  // Remove a specific listener from the server.
  // This also closes all of the connections associated with the listener.
  //
  // Returns a promise, which
  // * resolves if
  //   - the listener detached successfully (see WSServerListener.detach)
  // * rejects if
  //   - the listener is not an instance of WSServerListener
  //   - the listener provided is not part of this server
  //   - the listener detached unsuccessfully (see WSServerListener.detach)
  removeListener (listener) {
    return Promise.resolve().then(() => {
      if (!(listener instanceof WSServerListener)) {
        throw new Error('The listener provided is not an instance of WSServerListener.')
      }
      if (!this.listeners.has(listener)) {
        throw new Error('The listener provided is not associated with this server.')
      }
    }).then(() => {
      this.listeners.delete(listener)
      return listener.detach()
    })
  }

  // Removes all listeners from the server.
  // Limit is a number that specifies how many listeners to work on detaching
  // at once. falsy value = no limit
  //
  // Rejects if one of the listeners failed detaching. Note that all listeners will
  // be detached regardless of rejection status.
  removeAllListeners (limit) {
    const limiter = promiseLimit(limit)
    return Promise.resolve().then(() => {
      const promises = []
      for (let listener of this.listeners) {
        const promise = limiter(() => this.removeListener(listener))
        promises.push(promise)
      }
      return Promise.all(promises)
    })
  }

  // Disconnects all clients.
  //
  // TODO
  stopClients () {
    // TODO
  }

  // Disconnects all clients that have been created through direct calls to
  // handleUpgrade.
  //
  // TODO
  stopStandaloneClients () {
    // TODO
  }

  // Fully stops the server. Removes all listeners AND removes any remaining
  // non-listener clients.
  // Limit is passed to `removeAllListeners`.
  //
  // Rejects if removeAllListeners or stopStandaloneClients rejects, or if
  // there are clients remaining after calling removeAllListeners
  // and stopStandaloneClients.
  stop (limit) {
    return Promise.resolve().then(() => {
      return this.removeAllListeners(limit)
    }).then(() => {
      return this.stopStandaloneClients()
    }).then(() => {
      if (this.clients.size) {
        throw new Error(`[BUG] There are still ${this.clients.size} connected to this server, despite detaching all listeners and stopping all standalone clients.`)
      }
    })
  }
}

// This function makes sure that this socket is okay to be connected to the specified path.
//
// Returns one of three codes:
//
// 0 - Socket is fine to connect, continue the upgrade.
// 1 - There is no path to handle this connection.
//     Handler abort the handshake with the code 400,
//     unless closeUnknownEarly is false.
// 2 - Another server is supposed to handle this upgrade path. Don't do anything.
function checkSocketPath (listener, req) {
  const path = listener.options.get('path')
  if (!path) return 0
  const parsedURL = url.parse(req.url)
  const httpPath = parsedURL ? parsedURL.pathname : null
  if (path.has(httpPath)) return 0
  if (
    listener.httpServer._webSocketPaths[httpPath] ||
    listener.httpServer._webSocketPaths['%%WSPATHALL%%'] // TODO: is this necessary?
  ) return 2
  return 1
}

// Aborts the socket handshake. Tries to end the connection with an HTTP status,
// not doing anything if the socket is already closed (not writable).
function abortSocketHandshake (socket, code, text) {
  if (socket.writable) {
    const response = [
      `HTTP/1.1 ${code} ${STATUS_CODES[code]}`,
      'Content-Type: text/plain',
      '',
      text,
      '',
      ''
    ].join('\r\n')
    socket.end(response)
  }
}
