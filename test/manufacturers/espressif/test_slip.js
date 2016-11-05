"use strict";

const assert = require("chai").assert;
const Rx = require("rxjs/Rx");
// TODO: Fragile import!
const slip = require("../../../manufacturers/espressif/slip");
const FE = slip.CODES.frameEnd;

describe("encode", () => {
    it("starts and ends with frame end markers", () => {
        const data = Uint8Array.of(1, 2);

        const slipped = slip.encode(data);

        assert.equal(slipped.length, 4);
        assert.deepEqual(slipped,
            Uint8Array.of(FE, 1, 2, FE)
        );
    });

    it("escapes frame ends", () => {
        const data = Uint8Array.of(FE);

        const slipped = slip.encode(data);

        assert.equal(slipped.length, 4);
        assert.deepEqual(slipped,
            Uint8Array.of(FE, slip.CODES.frameEscape, slip.CODES.transposedFrameEnd, FE)
        );
    });
});

describe("decodeStream", () => {
    it("emits decoded streams only", () => {
        const results = [];
        const source$ = Rx.Observable.from(['N', 'O', FE, 1, 2, 3, FE,
                                            'N', 'O', FE, 4, 5, 6, FE,
                                            'N', 'O']);

        slip.decodeStream(source$)
            .subscribe(x => results.push(x));

        assert.equal(results.length, 2);
        assert.deepEqual(results[0], Uint8Array.of(1, 2, 3));
        assert.deepEqual(results[1], Uint8Array.of(4, 5, 6));
    });

    it("unescapes frame markers", () => {
        const source$ = Rx.Observable.from([FE, 1, 2,
                                            slip.CODES.frameEscape, slip.CODES.transposedFrameEnd,
                                            3, 4,
                                            slip.CODES.frameEscape, slip.CODES.transposedFrameEscape,
                                            FE]);

        slip.decodeStream(source$)
            .subscribe(x => assert.deepEqual(
                x,
                Uint8Array.of(1, 2, FE, 3, 4, slip.CODES.frameEscape)
            )
        );
    });
});