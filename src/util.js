'use strict'

const url = require('url')
const http = require('http')

export function createBasicHTTPServer (options) {
  const path = options.get('path')

  const server = http.createServer((req, res) => {
    const requestedPath = url.parse(req.url).pathname

    let returnCode = 426

    if (path && !path.has(requestedPath)) {
      returnCode = 426
    }

    const body = http.STATUS_CODES[returnCode]
    res.writeHead(returnCode, {
      'content-length': body.length,
      'content-type': 'text/plain'
    })
    res.end(body)
  })

  // TODO: allowHalfOpen?

  return server
}
