"use strict";

const assert = require("chai").assert;
const Rx = require("rxjs/Rx");
const EventEmitter = require("events");
// TODO: Fragile import!
const Device = require("../../../manufacturers/espressif/device");
const slip = require("../../../manufacturers/espressif/slip");




function DummyComm() {
    const evt = new EventEmitter();
    const out$ = new Rx.Subject();

    function trackAction(action) {
        out$.next([action, ...arguments]);
    }

    const responseQueue = [];

    function dummy() {

    }

    function makeResult() {
        return slip.encode(Uint8Array.from(arguments));
    }

    const RESPONSES = {
        MISSING_HEADER: makeResult(0)
    };

    function addResponse(key) {
        responseQueue.push(key);
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
        const key = responseQueue.shift();
        const response = RESPONSES[key];
        console.log("Got response:", key, response);
        return response;
    }

    function send(data, callback) {
        trackAction("send", data, callback);
        const response = _determineResponse(data);
        evt.emit('data', response);
        if (callback) callback();
    }

    function setOptions(options, callback) {
        trackAction("setOptions", options, callback);
        if (callback) callback();
    }

    return {
        open: dummy,
        close: dummy,
        flush: dummy,
        send: send,
        bindObserver: bindObserver,
        setOptions: setOptions,
        _out$: out$,
        _addResponse: addResponse
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
        it("follows proper bootloader sequence", (done) => {

            device.resetIntoBootLoader();
                dummyComm._out$
                .filter(call => call[0] === "setOptions")
                .take(3)
                .timeout(120)
                .subscribe(
                    x => x,
                    err => {
                        assert.fail(err);
                        done();
                    },
                    () => {
                        done();
                    }
                );
            });
    });
});