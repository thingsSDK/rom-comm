"use strict";

const Device = require('./device');
const SerialComm = require('./serial');
const Boards = require('./boards');
const log = require("../../logger");

const registry = new Map([
  [0x00062000, Boards.ESP8266],
  [0x15122500, Boards.ESP32]
]);

//  FIXME: /shrug This worthwhile?
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
  ESP8266: Boards.ESP8266,
  AutoDetect: AutoDetect,
  SerialComm: SerialComm
};
