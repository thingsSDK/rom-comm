"use strict";

const Rx = require("rxjs/Rx");
const log = require("../../logger");
// TODO: detect this automatically, not sure there will be others
const Comm = require("./serial");


const FLASH_MODES = {
    qio: 0,
    qout: 1,
    dio: 2,
    dout: 3
};

const FLASH_FREQUENCIES = {
    "40m": 0,
    "26m": 1,
    "20m": 2,
    "80m": 0xf
};

const FLASH_SIZES = {
    "4m": 0x00,
    "2m": 0x10,
    "8m": 0x20,
    "16m": 0x30,
    "32m": 0x40,
    "16m-c1": 0x50,
    "32m-c1": 0x60,
    "32m-c2": 0x70
};

const Options = {
    /**
     * Tested: Adafruit Feather Huzzah
     * Needs testing: Adafruit Huzzah, SparkFun Thing, SparkFun Thing Dev Board
     */
    Esp12: {
        flashFrequency: "80m",
        flashMode: "qio",
        flashSize: "32m",
        bootLoaderSequence: [
            [0, {rts: true, dtr: false}],
            [5, {rts: false, dtr: true}],
            [50, {rts: false, dtr: false}]
        ]
    }
};

module.exports = function(options) {
    const comm = Comm(options);
    // TODO: detect this
    const boardName = options.boardName || "Esp12";

    function resetIntoBootLoader() {
        log.info("Resetting into bootloader...");
        const at = new Map(Options[boardName].bootLoaderSequence);
        const sequence$ = Rx.Observable
            .interval(1)
            .filter(key => at.has(key))
            .take(at.size);

        sequence$.subscribe(
            key => {
                log.debug("Setting port", key, at.get(key));
                comm.setOptions(at.get(key), () => {
                    log.info("Port set", at.get(key));
                });
            },
            err => log.error("Problems resetting into bootloader mode", err),
            done => log.info("Did it")
        );
    }

    const response$ = Rx.Observable.create(observer => {
        comm.bindObserver(observer);
    })
        .flatMap(data => Rx.Observable.from(data))
        .share();

    return {
        open: comm.open.bind(comm),
        resetIntoBootLoader: resetIntoBootLoader,
        // DEBUG ONLY
        response$: response$
    };
};
