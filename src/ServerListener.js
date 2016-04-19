'use strict'

import {createBasicHTTPServer} from './util'
import {WSServerListenerOptions} from './options'

export default class WSServerListener {
  constructor (options, socketServer) {
    this.options = new WSServerListenerOptions(options)
    this.socketServer = socketServer

    // Whether the listener has attached, and is listening
    // to new WebSocket connections.
    this.isAttached = false

    // Whether the httpServer that was created is our own.
    this.isHTTPServerCreator = !options.get('server')

    // Set of WSServerClients that are associated with this listener.
    this.clients = new Set()

    if (this.isHTTPServerCreator) {
      this.httpServer = createBasicHTTPServer(options)
    } else {
      this.httpServer = options.get('server')
    }
  }

  // HTTP upgrade handler for the server.
  // Passes values to server's handleUpgrade function.
  // This function exists only so we can keep a reference to the function that
  // is listening to the 'upgrade' HTTP server event.
  _handleServerUpgrade (req, socket, upgradeHead) {
    return this.socketServer.handleUpgrade(req, socket, upgradeHead, this)
  }

  // Attaches the listener. This will (depending on the options)
  // create an HTTP server listening on a port or attach itself to a HTTP(S)
  // server.
  //
  // It will create its own server ONLY if a port is given in the options.
  // If the port provided is 0, then it will call net.Server's `.listen()` function
  // with the port 0, which accoding to the documentation, will assign a random port.
  //
  // * resolves if
  //   - the listener was able to create or attach to the HTTP(S) server successfully
  // * rejects if
  //   - the listener is already attached
  //   - net.Server's `.listen()` function calls back with an error
  //   - there is a path conflict with the provided HTTP(S) server,
  //     which happens if there are multiple listeners listening to the
  //     same HTTP(S) server on the same path
  attach () {
    return Promise.resolve().then(() => {
      if (this.isAttached) {
        throw new Error('Listener is already attached')
      }
      const httpServer = this.httpServer
      if (typeof httpServer._webSocketPaths !== 'object') httpServer._webSocketPaths = {}

      const paths = this.options.get('path')
      const wsPaths = httpServer._webSocketPaths

      const conflictError = new Error('There must be only one WebSocket server listening on the same HTTP server path.')
      if (!paths) {
        if (wsPaths['%%WSPATHALL%%']) {
          throw conflictError
        }
        wsPaths['%%WSPATHALL%%'] = this
      } else {
        if (wsPaths['%%WSPATHALL%%']) {
          throw conflictError
        }

        for (let path of paths) {
          if (wsPaths[path]) {
            throw conflictError
          }
          wsPaths[path] = this
        }
      }

      httpServer.on('upgrade', this._handleServerUpgrade)
    }).then(() => {
      if (this.isHTTPServerCreator) {
        return startHTTPListen(this)
      }
    })
  }

  // Detaches the listener. This will
  //
  // * Close all clients' connections related to the server with close code 1001
  // * Stop listening to WebSocket connections on the http(s) server
  // * If the server is a server that we created, the server is shut down
  //
  // * resolves if
  //   - the self-created server was closed properly
  // * rejects if
  //   - the listener is not already attached
  //   - the self-created server's `.close()` function called back with an error
  detach () {
    return Promise.resolve().then(() => {
      // TODO
    })
  }
}

// Starts listening to our self-created server.
// Returns a promise, that resolves when the listen callback
// succeeded without an error, rejecting otherwise.
//
// If a server error occurs (via the error event), the listener will
// automatically detach, and emit an 'error' event on the server that is
// responsible for this listener.
function startHTTPListen (listener) {
  return new Promise((resolve, reject) => {
    const httpServer = listener.httpServer
    const options = listener.options

    httpServer.on('error', (err) => {
      // TODO: Handling of error
      err
    })

    function listenCallback (err) {
      if (err) return reject(err)
      return resolve()
    }

    let port = options.get('port') || 0
    const hostname = options.get('hostname')

    if (hostname) {
      httpServer.listen(port, hostname, listenCallback)
    } else {
      httpServer.listen(port, listenCallback)
    }
  })
}
