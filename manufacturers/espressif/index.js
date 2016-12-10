"use strict";

const Device = require('./device');
const SerialComm = require('./serial');

// TODO: Add an autodetect / factory as these start showing up

function ESP8266(comm, options) {
  options = options || {};
  // Force override
  Object.assign(options, {
    boardName: "Esp12"
  });
  return Device(comm, options);
}

module.exports = {
  ESP8266: ESP8266,
  SerialComm: SerialComm
};
