"use strict";

const espressif = require("./manufacturers/espressif");
const Device = require("./manufacturers/espressif/device");


// ROM Comm
const serial = (portName, serialOptions, deviceOptions = {}) => {
    // TODO: auto-detect this
    const comm = espressif.SerialComm(portName, serialOptions);
    // FIXME...awwwkward
    const device = Device(comm, deviceOptions);
    return espressif.ESP8266(device, deviceOptions.revisionName);
};

module.exports = {
    serial: serial
};
