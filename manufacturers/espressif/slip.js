"use strict";

const Rx = require("rxjs/Rx");

// https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol
const CODES = {
    frameEnd: 0xC0,
    frameEscape: 0xDB,
    transposedFrameEnd: 0xDC,
    transposedFrameEscape: 0xDD
 };

function encode(data) {
    // 100 extra bytes for escapes...probably overkill
    const encoded = new Uint8Array(data.byteLength + 100);
    let encodedLength = 0;
    encoded[0] = CODES.frameEnd;
    encodedLength++;

    const dataStream = Rx.Observable.from(new Uint8Array(data))
        .flatMap(value => {
            let values = [value];
            if (value === CODES.frameEnd) {
                values = [CODES.frameEscape, CODES.transposedFrameEnd];
            } else if (value === CODES.frameEscape) {
                values = [CODES.frameEscape, CODES.transposedFrameEscape];
            }
            // TODO:  Is this super expensive?
            return Rx.Observable.from(values);
        });

    dataStream.subscribe(x => {
        encoded[encodedLength] = x;
        encodedLength++;
    });
    encoded[encodedLength] = CODES.frameEnd;
    encodedLength++;
    return encoded.slice(0, encodedLength);
}

// Builds a byte based scan accumulator.  Use this with filter and map on the
// `result.emit` to get decoded emissions, like decodeStream.
function decodeAccumulator(acc, value) {
    const next = acc.buffer;
    // SLIP messages open and close with frameEnd
    if (value === CODES.frameEnd) {
        // Begin - start slipping and buffering
        if (!acc.slipping) {
            return {
                slipping: true,
                buffer: [],  // Resets the buffer
                emit: null
            };
        }
        // End - prepare for emit, reset buffer
        return {
            slipping: false,
            buffer: [],  // Resets the buffer
            emit: Uint8Array.from(next).buffer
        };
    }
    // If we are within the SLIP boundaries
    if (acc.slipping) {
        // And we encounter an escape
        if (value === CODES.frameEscape) {
            return {
                escapeNext: true,
                slipping: acc.slipping,
                buffer: next,
                emit: null
            };
        }
        // If the previous byte was the escape
        if (acc.escapeNext) {
            if (value === CODES.transposedFrameEnd) {
                value = CODES.frameEnd;
            } else if (value === CODES.transposedFrameEscape) {
                value = CODES.frameEscape;
            }
        }
        next.push(value);
    }
    return {
        slipping: acc.slipping,
        buffer: next,
        emit: null
    };

}

function decodeStream(stream$) {
    return stream$.scan(decodeAccumulator, {buffer: []})
        .filter(x => x.emit)
        .map(x => x.emit);
}

module.exports =  {
    CODES: CODES,
    encode: encode,
    decodeStream: decodeStream
};