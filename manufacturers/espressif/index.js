"use strict";
const Rx = require("rxjs/Rx");
const log = require("../../logger");
const Device = require('./device');
const device = Device({
    //port: "/dev/cu.wchusbserial1420",
    port: "/dev/cu.SLAB_USBtoUART",
    baudRate: 115200
});

device.response$.subscribe(
    data => log.debug("Top level", data),
    err => log.error("Whoops error on", err),
    () => log.debug("Donezo")
);

device.open((err) => {
    if (err) log.error(err);
    device.resetIntoBootLoader();
});
