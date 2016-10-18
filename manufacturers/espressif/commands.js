"use strict";

const slip = require('./slip');

const commands = {
    CMD0: 0x00,
    CMD1: 0x01,
    FLASH_DOWNLOAD_BEGIN: 0x02,
    FLASH_DOWNLOAD_DATA: 0x03,
    FLASH_DOWNLOAD_DONE: 0x04,
    RAM_DOWNLOAD_BEGIN: 0x05,
    RAM_DOWNLOAD_END: 0x06,
    RAM_DOWNLOAD_DATA: 0x07,
    SYNC_FRAME: 0x08,
    WRITE_REGISTER: 0x09,
    READ_REGISTER: 0x0A,
    SET_FLASH_PARAMS: 0x0B,
    NO_COMMAND: 0xFF
};

function commandToKey(command) {
    // value to key
    return Object
        .keys(commands)
        .find(key => commands[key] === command);
}


function calculateChecksum(data) {
    // Magic Checksum starts with 0xEF
    let result = 0xEF;
    for (let i = 0; i < data.length; i++) {
        result ^= data[i];
    }
    return result;
}

/**
 * Send appropriate C struct header along with command as required
 * SEE:  https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.h#L49
 */
function headerPacketFor(command, data) {
    let buf = new ArrayBuffer(8);
    let dv = new DataView(buf);
    let checksum = 0;
    if (command === commands.FLASH_DOWNLOAD_DATA) {
        // There are additional headers here....
        checksum = calculateChecksum(data.slice(16));
    } else if (command === commands.FLASH_DOWNLOAD_DONE) {
        // Nothing to see here
    } else {
        // Most commands want the checksum of the entire data packet
        checksum = calculateChecksum(data);
    }
    dv.setUint8(0, 0x00); // Direction, 0x00 is request
    dv.setUint8(1, command); // Command, see commands constant
    dv.setUint16(2, data.byteLength, true); // Size of request
    dv.setUint32(4, checksum, true);
    return new Buffer(buf);
}


const SYNC_FRAME = new Uint8Array([0x07, 0x07, 0x12, 0x20,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]);
function sync() {
    return prepareCommand(commands.SYNC_FRAME, SYNC_FRAME, {});
}

function bufferConcat(buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

function prepareCommand(command, data, options) {
    const sendHeader = headerPacketFor(command, data);
    const message = bufferConcat(sendHeader, data);
    return Object.assign({
        commandCode: command,
        data: slip.encode(message),
    }, options);
}

// NOTE: Data needs to be slip decoded
function toResponse(data) {
    if (data.length < 8) {
        throw Error('Missing header');
    }
    const dv = new DataView(data);
    const header = {
        direction: dv.getUInt8(0),
        command: dv.getUInt8(1),
        // NOTE: Little Endian represented by true here
        size: dv.getUInt16(2, true),
        checksum: dv.getUInt32(4, true)
    };

    // If it is not marked as a response
    if (header.direction != 0x01) {
        throw Error(`Invalid direction: ${header.direction}`);
    }
    return {
        commandCode: header.command,
        header: header,
        // TODO:  Ported this, but it seems like a bug
        body: data.slice(8, 8 + header.size)
    };



}

module.exports = {
    toResponse: toResponse,
    sync: sync
};
