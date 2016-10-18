"use strict";

const Rx = require("rxjs/Rx");
const log = require("../../logger");
// TODO: detect this automatically, not sure there will be others
const Comm = require("./serial");
const commands = require("./commands");
const slip = require("./slip");


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
            .take(at.size)
            .repeat(10);


        sequence$.subscribe(
            key => {
                log.debug("Setting port", key, at.get(key));
                comm.setOptions(at.get(key), () => {
                    log.info("Port set", at.get(key));
                });
            },
            err => log.error("Problems resetting into bootloader mode", err),
            done => comm.flush(() => sync())
        );
    }

    const response$ = Rx.Observable.create(observer => {
        // Binds and provides unbinding to the comm abstraction.
        return comm.bindObserver(observer);
    })
        .flatMap(data => Rx.Observable.from(data))
        .share();

    // TODO:  This is itching for reuse
    const sync = function() {
        // Request
        const metadata = commands.sync();
        Rx.Observable.of(metadata)
            .do(x => log.info('Attempting sync', metadata.data))
            .switchMap(x => {
                comm.send(metadata.data);
                return slip.decodeStream(response$);
            })
            // Response
            .do(x => log.info("Got back", x))
            .map(commands.toResponse)
            .filter(response => metadata.commandCode === response.commandCode)
            .take(1)
            // Handle errors (TODO: use metadata)
            .retry(10)
            .subscribe(
                (x) => log.info('Next', x),
                (err) => log.error(`Failed performing ${metadata.commandCode}`, err),
                () => log.info(`Successful ${metadata.commandCode}`)
            );
    };

    return {
        open: comm.open.bind(comm),
        resetIntoBootLoader: resetIntoBootLoader,
        sync: sync,
        // DEBUG ONLY
        response$: response$
    };
};
