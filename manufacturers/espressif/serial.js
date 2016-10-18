"use strict";

const SerialPort = require("serialport");
const log = require("../../logger");

module.exports = function(options) {
    const port = new SerialPort(options.port, {
        autoOpen: false,
        baudRate: options.baudRate,
        parity: "none",
        stopBits: 1,
        xon: false,
        xoff: false,
        rtscts: false,
        dsrdtr: false
    });

    function bindObserver(observer) {
        const dataBinding = data => observer.next(data);
        const errorBinding = error => observer.error(error);
        const doneBinding = () => observer.complete();
        port.on("data", dataBinding);
        port.on("error", errorBinding);
        port.on("close", doneBinding);

        return () => {
            port.removeListener("data", dataBinding);
            port.removeListener("error", errorBinding);
            port.removeListener("close", doneBinding);
        };
    }

    function send(data, errorCallback) {
        return port.write(data, (err) => {
            if (err) errorCallback(err);
            flush();
        });
    }

    function setOptions(options, callback) {
        return port.set(options, callback);
    }

    function open(cb) {
        return port.open(cb);
    }

    function flush(cb) {
        log.info("Flushing...");
        return port.flush(cb);
    }

    return {
        open: open,
        flush: flush,
        send: send,
        bindObserver: bindObserver,
        setOptions: setOptions
    };
};
