"use strict";

const Rx = require("rxjs/Rx");
const log = require("../../logger");
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
    "512KB": 0x00,
    "256KB": 0x10,
    "1MB": 0x20,
    "2MB": 0x30,
    "4MB": 0x40,
    "2MB-c1": 0x50,
    "4MB-c1": 0x60,
    "4MB-c2": 0x70
};

const BoardSpecific = {
    /**
     * Tested: Adafruit Feather Huzzah
     * Needs testing: Adafruit Huzzah, SparkFun Thing, SparkFun Thing Dev Board
     */
    Esp12: {
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

module.exports = function(comm, options) {
    options = options || {};
    const boardName = options.boardName || "Esp12";
    const defaultProgressHandler = (state) => log.info("Current progress", state);
    const onProgress = options.onProgress || defaultProgressHandler;
    const _state = {};

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
    // Manages flow to the stacks requests that use bootloader mode
    const queue$ = new Rx.Subject();
    const stopper$ = new Rx.Subject();


    // Reusable Request/Response cycle
    // Validates and retries
    function createRequestObservable$ (request) {
        // FIXME: sender$ does IO...that seems bad
        return Rx.Observable.defer(() => sender$(request.data))
            // Response coming in from responses$ is already SLIP decoded
            .switchMap(() => responses$
                .map(raw => commands.toResponse(raw))
                .skipWhile(response => request.commandCode !== response.commandCode)
                .do(response => {
                    if (!request.validate(response.body)) {
                        throw Error("Response validation failed: " + response.body);
                    }
                    if (request.onSuccess) {
                        request.onSuccess.apply(null, [response]);
                    }
                })
            )
            .timeout(request.timeout)
            .retry(100)
            .take(1);
    }

    queue$
        .zip(requests$, (_, request) => request)
        .do(request => log.debug(`Processing ${request.displayName}...`))
        .switchMap(request => createRequestObservable$(request))
        .takeUntil(stopper$)
        .subscribe(
            (x) => {
                log.debug("Loop complete.  Response was", x);
                queue$.next(true);
            },
            (err) => log.error("Oh no", err),
            () => log.debug("Completed!")
        );

    const queueRequest = function(displayName, request, options) {
        request.displayName = displayName;
        if (options) {
            // Stitches things like onSuccess onto the request.
            Object.assign(request, options);
        }
        requests$.next(request);
    };

    const setBootloaderMode = enabled => {
        log.debug("Setting bootloader mode", enabled);
        if (enabled) {
            // Open the floodgates
            queue$.next(true);
        } else {
            // Close the floodgates
            stopper$.next(true);
        }
    };

    // Device commands


    // Gets device and software on same page...
    // This is whacky, but after about 10 successful interactions, things get right
    function sync() {
        const metadata = commands.sync();
        metadata.displayName = 'sync';
        createRequestObservable$(metadata)
            .repeat(10)
            .subscribe(
                x => log.debug("Sync round complete", x),
                err => log.error("Sync problems", err),
                () => {
                    log.info("Successful sync, setting mode");
                    setBootloaderMode(true);
                }
            );
    }

    function resetIntoBootLoader() {
        log.info("Resetting into bootloader...");
        const at = new Map(BoardSpecific[boardName].bootLoaderSequence);
        const sequence$ = Rx.Observable
            .interval(1)
            .filter(key => at.has(key))
            .flatMap(key => Rx.Observable.defer(() => setOptions$(at.get(key))))
            .take(at.size);

        sequence$
            .subscribe(
                key => log.debug("Set comm", key, at.get(key)),
                err => log.error("Problems resetting into bootloader mode", err),
                done => comm.flush(() => {
                    log.info("Bootloader mode acheived");
                    sync();
                })
        );
    }

    const flashAddress = function(address, data) {
        const flashInfo = {
            flashMode: FLASH_MODES[BoardSpecific[boardName].flashMode],
            flashSizeFrequency: FLASH_SIZES[BoardSpecific[boardName].flashSize] + FLASH_FREQUENCIES[BoardSpecific[boardName].flashFrequency]
        };
        queueRequest('flashBegin', commands.flashBegin(address, data.byteLength));
        const cmds = commands.flashAddress(address, data, flashInfo);
        cmds.forEach((cmd, index) => {
           queueRequest(`flashAddress[${index + 1} of ${cmds.length}]`, cmd, {
               onSuccess: () => {
                   _state.flashedBytes += commands.FLASH_BLOCK_SIZE;
                   onProgress(_state);
               }
           });
        });
    };

    const flashFinish = function(onComplete) {
        flashAddress(0, 0);
        queueRequest('flashFinish', commands.flashFinish(), {
            onSuccess: () => {
                setBootloaderMode(false);
                if (onComplete) {
                    onComplete.apply();
                }
            }
        });
    };

    const flash = function(specs, onComplete) {
        resetIntoBootLoader();
        _state.totalBytes = specs.reduce((counter, spec) => {
            return counter + spec.buffer.length;
        }, 0);
        _state.flashedBytes = 0;
        for (let spec of specs) {
            flashAddress(Number.parseInt(spec.address), spec.buffer);
        }
        flashFinish(onComplete);
    };

    const readRegister = function(address, callback) {
        resetIntoBootLoader();
        queueRequest('readRegister', commands.readRegister(address), {
            onSuccess: (response) => {
                callback(null, response.header.value);
            }
        });
    };

    return {
        open: comm.open.bind(comm),
        close: comm.close.bind(comm),
        flash: flash,
        readRegister: readRegister
    };
};
