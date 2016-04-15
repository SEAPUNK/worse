'use strict'

const bluebird = require('bluebird')
global.Promise = bluebird
const promisify = bluebird.promisify

Promise.resolve().then(() => {

}).catch((err) => {
  console.log(err.stack)
  process.exit(1)
})