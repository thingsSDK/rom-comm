"use strict";

const assert = require("chai").assert;
const Rx = require("rxjs/Rx");
// TODO: Fragile!
const slip = require("../manufacturers/espressif/slip");
const FE = slip.CODES.frameEnd;

describe("decodeStream", () => {
    it("emits decoded streams only", () => {
        const results = [];
        const source$ = Rx.Observable.from(['N', 'O', FE, 1, 2, 3, FE,
                                            'N', 'O', FE, 4, 5, 6, FE,
                                            'N', 'O']);

        slip.decodeStream(source$)
            .subscribe(x => results.push(x));

        assert.deepEqual(results[0], [1, 2, 3]);
        assert.deepEqual(results[1], [4, 5, 6]);
    });
});