"use strict";

const Device = require('./device');
const SerialComm = require('./serial');
const log = require("../../logger");

const registry = new Map([
  [0x00062000, ESP8266],
  [0x15122500, ESP32]
]);


function ESP8266(comm, options) {
  options = options || {};
  // Force override
  Object.assign(options, {
    boardName: "Esp12"
  });
  return Device(comm, options);
}

function ESP32(comm, options) {
  options = options || {};
  // Force override
  Object.assign(options, {
    boardName: "Esp12"
  });
  return Device(comm, options);
}

function AutoDetect(comm, options) {
  const UART_DATA_REG_ADDR = 0x60000078;
  options = options || {};
  const device = Device(comm, options);
  log.info("Auto detecting based on UART");
  device.open(() => {
    device.readRegister(UART_DATA_REG_ADDR, (err, value) => {
      log.info("Auto-detect is finding", value, registry.get(value));
   });
  });
}

module.exports = {
  ESP8266: ESP8266,
  AutoDetect: AutoDetect,
  SerialComm: SerialComm
};
