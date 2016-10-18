"use strict";
const Rx = require("rxjs/Rx");
const log = require("../../logger");
const Device = require('./device');
const device = Device({
    port: "/dev/cu.wchusbserial1420",
    baudRate: 115200
});

device.response$.subscribe(
    data => log.debug("Got back next", data),
    err => log.error("Whoops error on", err),
    () => log.debug("Donezo")
);

device.open((err) => {
    if (err) log.error(err);
    device.resetIntoBootLoader();
    Rx.Observable.of(1).delay(500).repeat(10).subscribe(x => device.sync());
    Rx.Observable.of(1).delay(500).repeat(10).subscribe(x => device.sync());
    Rx.Observable.of(1).delay(500).repeat(10).subscribe(x => device.sync());
    Rx.Observable.of(1).delay(500).repeat(10).subscribe(x => device.sync());

});
