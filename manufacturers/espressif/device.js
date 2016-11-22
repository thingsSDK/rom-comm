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
    const comm = options.comm;
    // TODO: detect this
    const boardName = options.boardName || "Esp12";

    const commandQueue = [];
    let isBusy = false;

    const queue$ = new Rx.Subject();

    const setOptions$ = Rx.Observable.bindNodeCallback(comm.setOptions);

    function resetIntoBootLoader() {
        log.info("Resetting into bootloader...");
        const at = new Map(Options[boardName].bootLoaderSequence);
        const sequence$ = Rx.Observable
            .interval(1)
            .filter(key => at.has(key))
            .flatMap(key => Rx.Observable.defer(() => setOptions$(at.get(key))))
            .take(at.size);

        sequence$
            .subscribe(
                key => log.debug("Set port", key, at.get(key)),
                err => log.error("Problems resetting into bootloader mode", err),
                done => comm.flush(() => {
                    log.info("Bootloader mode acheived");
                    sync();
                })
        );
    }

    const rawResponse$ = Rx.Observable.create(observer => {
        // Binds and provides unbinding to the comm abstraction.
        return comm.bindObserver(observer);
    })
        .flatMap(data => Rx.Observable.from(data))
        .share();

    const responses$ = slip.decodeStream(rawResponse$);
    const requests$ = new Rx.Subject();

    const sendCommand = function(displayName, metadata) {
        metadata.displayName = displayName;
        requests$.next(metadata);
    };
    const sender$ = Rx.Observable.bindNodeCallback(comm.send);

    const createRequestObservable$ = metadata => {
        return Rx.Observable.defer(() => sender$(metadata.data))
        .do(() => log.info("Sent request: " + metadata.displayName))
        // Response
        .flatMap(() => responses$
            .map(raw => commands.toResponse(raw))
            .do(response => log.info("Received response", response))
            .skipWhile(response => metadata.commandCode !== response.commandCode)
            .do(response => {
                if (!metadata.validate(response.body)) {
                    throw Error("Response validation failed: " + response.body);
                }
            })
            .do(response => log.info("Valid response", response))
        )
        .timeout(metadata.timeout)
        .retry(10)
        .take(1);

    };

    queue$
        .zip(requests$, (_, metadata) => metadata)
        .flatMap(metadata => createRequestObservable$(metadata))
        .subscribe(
            (x) => {
                log.info("Loop complete sending next request", x);
                queue$.next(true);
            },
            (err) => log.error("Oh no", err),
            () => log.info("Completed!")
        );

    const sync = function() {
        const metadata = commands.sync();
        metadata.displayName = 'sync';
        createRequestObservable$(metadata)
            .repeat(10)
            .subscribe(
                x => log.info("Sync round complete", x),
                err => log.error("Sync problems", err),
                () => {
                    log.info("Successful sync, opening flood gates");
                    queue$.next(true);
                }
            );
    };

    const flashAddress = function(address, data) {
        const flashInfo = {
            flashMode: FLASH_MODES[Options[boardName].flashMode],
            flashSize: FLASH_SIZES[Options[boardName].flashSize]
        };
        sendCommand('flashBegin', commands.flashBegin(address, data.byteLength));
        const cmds = commands.flashAddress(address, data, flashInfo);
        cmds.forEach((cmd, index) => {
           sendCommand(`flashAddress[${index + 1} of ${cmds.length}]`, cmd);
        });
    };

    const flashFinish = function() {
        flashAddress(0, 0);
        sendCommand('flashFinish', commands.flashFinish());
    };

    return {
        open: comm.open.bind(comm),
        close: comm.close.bind(comm),
        resetIntoBootLoader: resetIntoBootLoader,
        sync: sync,
        flashAddress: flashAddress,
        flashFinish: flashFinish,
    };
};
