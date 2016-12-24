"use strict";

function ESP8266(device, revisionName = 'ESP-12') {
    const revisionByName = (name) => {
    // TODO:  Translation table ESP-12e ESP-1 etc;  Switch?
        const Options = {
            /**
             * Tested: Adafruit Feather Huzzah
             * Needs testing: Adafruit Huzzah, SparkFun Thing, SparkFun Thing Dev Board
            */
            'ESP-12': {
                flashFrequency: "80m",
                flashMode: "qio",
                flashSize: "4MB",
                // RTS - Request To Send
                // DTR - Data Terminal Ready
                // NOTE: Must set values at the same time.
                bootLoaderSequence: [
                    [0, {rts: true, dtr: false}],
                    [5, {rts: false, dtr: true}],
                    [50, {rts: false, dtr: false}]
                ]
            }
        };
        return Options[name];
    };

    const settings = revisionByName(revisionName);
    // TODO merge other board level settings

    // Creates a partial device function
    const flash = (specs, onComplete) => device.flash(settings, specs, onComplete);

    return {
        open: device.open.bind(device),
        close: device.close.bind(device),
        flash: flash
    };
}

module.exports = {
    ESP8266: ESP8266
};

