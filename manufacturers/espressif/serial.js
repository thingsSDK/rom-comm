"use strict";

const SerialPort = require("serialport");

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
        port.on("data", data => observer.next(data));
        port.on("error", error => observer.error(error));
        port.on("close", () => observer.done());
    }

    function setOptions(options, callback) {
        return port.set(options, callback);
    }

    return {
        open: port.open.bind(port),
        bindObserver: bindObserver,
        setOptions: setOptions
    };
};
