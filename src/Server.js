'use strict'

import {EventEmitter} from 'events'

import promiseLimit from 'promise-limit'

import WSServerOptions from './ServerOptions'
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
    this.stop = this.removeAllListeners
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
      listener = new WSServerListener(options)
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
}
