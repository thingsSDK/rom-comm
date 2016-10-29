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

    function send(data, cb) {
        return port.write(data, (err) => {
            if (err) log.error(err);
            flush();
            cb(err);
        });
    }

    function setOptions(options, callback) {
        return port.set(options, callback);
    }

    function close(cb) {
        return port.close(cb);
    }

    function flush(cb) {
        log.debug("Flushing...");
        return port.flush(cb);
    }

    return {
        open: port.open.bind(port),
        close: close,
        flush: flush,
        send: send,
        bindObserver: bindObserver,
        setOptions: setOptions
    };
};
