"use strict";

const assert = require("chai").assert;
const Rx = require("rxjs/Rx");
const EventEmitter = require("events");
// TODO: Fragile import!
const Device = require("../../../manufacturers/espressif/device");

function DummyComm() {
    const evt = new EventEmitter();
    const out = {
        send: [],
        setOptions: []
    };

    function dummy() {

    }

    function bindObserver(observer) {
        const dataBinding = data => observer.next(data);
        const errorBinding = error => observer.error(error);
        const doneBinding = () => observer.complete();
        evt.on("data", dataBinding);
        evt.on("error", errorBinding);
        evt.on("close", doneBinding);

        return () => {
            evt.removeListener("data", dataBinding);
            evt.removeListener("error", errorBinding);
            evt.removeListener("close", doneBinding);
        };
    }

    function _determineResponse(data) {
        // TODO: Build response and SLIP Encode it.
        return data;
    }

    function send(data, callback) {
        out.send.push(data);
        const response = _determineResponse(data);
        evt.emit('data', response);
        if (callback) callback();
    }

    function setOptions(options, callback) {
        out.setOptions.push(options);
        if (callback) callback();
    }

    return {
        open: dummy,
        close: dummy,
        flush: dummy,
        send: send,
        bindObserver: bindObserver,
        setOptions: setOptions,
        out: out
    };
}

describe("Esp12", () => {
    let device;
    let dummyComm;
    beforeEach(() => {
        dummyComm = DummyComm();
        device = Device({comm: dummyComm});
    });

    describe("resetIntoBootloader", () => {
        it("follows bootloader sequence", (done) => {
            device.resetIntoBootLoader();
            Rx.Observable
                .interval(100)
                .take(1)
                .subscribe(
                    null,
                    null,
                    () => {
                        assert.equal(dummyComm.out.setOptions.length, 3);
                        done();
                    }
                );
        });
    });

    describe("sync", () => {
        it("responds", () => {
            device.sync();
        });
    });
});