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
    this.isHttpServerCreator = !options.get('server')

    // Set of WSServerClients that are associated with this listener.
    this.clients = new Set()

    if (this.isHttpServerCreator) {
      this.httpServer = createBasicHTTPServer(options)
    } else {
      this.httpServer = options.get('server')
    }
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

      // TODO: allowHalfOpen?

      // TODO
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
