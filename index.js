"use strict";

const espressif = require("./manufacturers/espressif");


// ROM Comm
const serial = (portName, serialOptions, deviceOptions) => {
    // TODO: auto-detect this
    const comm = espressif.SerialComm(portName, serialOptions);
    return espressif.ESP8266(comm, deviceOptions);
};

module.exports = {
    serial: serial
};
