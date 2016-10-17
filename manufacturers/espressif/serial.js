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
        const dataBinding = data => observer.next(data);
        const errorBinding = error => observer.error(error);
        const doneBinding = () => observer.done();
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
        return port.write(data, errorCallback);
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
