'use strict'

const SERVER_DEFAULTS = {

}

const SERVER_LISTENER_DEFAULTS = {

}

export class WSServerListenerOptions extends Options {
  constructor (options, defaults) {
    super(options, SERVER_LISTENER_DEFAULTS)
  }
}

export class WSServerOptions extends Options {
  constructor (options, defaults) {
    super(options, SERVER_DEFAULTS)
  }
}

export class Options {
  constructor (options, defaults) {
    this.options = Object.assign({}, defaults, options)
  }

  get (prop) {
    return this.options[prop]
  }

  set (prop, data) {
    this.options[prop] = data
  }
}
