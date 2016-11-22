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

    const queue$ = new Rx.Subject();
    const setOptions$ = Rx.Observable.bindNodeCallback(comm.setOptions);
    const sender$ = Rx.Observable.bindNodeCallback(comm.send);

    const rawResponse$ = Rx.Observable.create(observer => {
        // Binds and provides unbinding to the comm abstraction.
        return comm.bindObserver(observer);
    })
        .flatMap(data => Rx.Observable.from(data))
        .share();

    const responses$ = slip.decodeStream(rawResponse$);
    const requests$ = new Rx.Subject();

    function sync() {
        const metadata = commands.sync();
        metadata.displayName = 'sync';
        createRequestObservable$(metadata)
            .repeat(10)
            .subscribe(
                x => log.debug("Sync round complete", x),
                err => log.error("Sync problems", err),
                () => {
                    log.info("Successful sync, opening flood gates");
                    queue$.next(true);
                }
            );
    }

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

    const queueRequest = function(displayName, metadata) {
        metadata.displayName = displayName;
        requests$.next(metadata);
    };

    const createRequestObservable$ = metadata => {
        return Rx.Observable.defer(() => sender$(metadata.data))
        // Response
        .flatMap(() => responses$
            .map(raw => commands.toResponse(raw))
            .skipWhile(response => metadata.commandCode !== response.commandCode)
            .do(response => {
                if (!metadata.validate(response.body)) {
                    throw Error("Response validation failed: " + response.body);
                }
            })
        )
        .timeout(metadata.timeout)
        .retry(100)
        .take(1);

    };

    queue$
        .zip(requests$, (_, metadata) => metadata)
        .do(metadata => log.debug(`Processing ${metadata.displayName}...`))
        .flatMap(metadata => createRequestObservable$(metadata))
        .subscribe(
            (x) => {
                log.debug("Loop complete sending next request", x);
                queue$.next(true);
            },
            (err) => log.error("Oh no", err),
            () => log.debug("Completed!")
        );



    const flashAddress = function(address, data) {
        const flashInfo = {
            flashMode: FLASH_MODES[Options[boardName].flashMode],
            flashSize: FLASH_SIZES[Options[boardName].flashSize]
        };
        queueRequest('flashBegin', commands.flashBegin(address, data.byteLength));
        const cmds = commands.flashAddress(address, data, flashInfo);
        cmds.forEach((cmd, index) => {
           queueRequest(`flashAddress[${index + 1} of ${cmds.length}]`, cmd);
        });
    };

    const flashFinish = function() {
        flashAddress(0, 0);
        queueRequest('flashFinish', commands.flashFinish());
    };

    return {
        open: comm.open.bind(comm),
        close: comm.close.bind(comm),
        resetIntoBootLoader: resetIntoBootLoader,
        flashAddress: flashAddress,
        flashFinish: flashFinish,
    };
};
