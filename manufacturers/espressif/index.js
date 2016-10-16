"use strict";

const log = require("../../logger");
const Device = require('./device');
const device = Device({
    port: "/dev/cu.wchusbserial1420",
    baudRate: 115200
});


device.responseStream.subscribe(
    data => log.info("Got back next", data),
    err => log.error("Whoops error on", err),
    () => log.info("Donezo")
);

device.open(() => {
    device.resetIntoBootLoader();
});
