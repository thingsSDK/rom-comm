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

    function bindObserver(observer, callback) {
        const dataBinding = data => {
            observer.next(data);
            callback.apply(null, data);
        };
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

    function send(data, callback) {
        return port.write(data, (err) => {
            if (err) log.error(err);
            port.flush();
            callback(err);
        });
    }

    function setOptions(options, callback) {
        return port.set(options, callback);
    }

    function close(cb) {
        return port.close(cb);
    }

    return {
        open: port.open.bind(port),
        close: port.close.bind(port),
        flush: port.flush.bind(port),
        send: send,
        bindObserver: bindObserver,
        setOptions: setOptions
    };
};
