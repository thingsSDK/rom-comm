"use strict";

const espressif = require("./manufacturers/espressif");


// ROM Comm
module.exports = function ROMComm(portName, options) {
    // TODO: auto-detect this
    const comm = espressif.SerialComm(portName);
    return espressif.ESP8266(comm, options);
};