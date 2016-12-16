"use strict";

const slip = require('./slip');
const log = require("../../logger");

const commands = {
    CMD0: 0x00,
    CMD1: 0x01,
    FLASH_BEGIN: 0x02,
    FLASH_DATA: 0x03,
    FLASH_DONE: 0x04,
    RAM_BEGIN: 0x05,
    RAM_END: 0x06,
    RA_DATA: 0x07,
    SYNC_FRAME: 0x08,
    WRITE_REGISTER: 0x09,
    READ_REGISTER: 0x0A,
    SET_FLASH_PARAMS: 0x0B,
    NO_COMMAND: 0xFF
};
const FLASH_BLOCK_SIZE = 0x400;
const SECTORS_PER_BLOCK = 16;
const SECTOR_SIZE = 4096;

function commandToKey(command) {
    // value to key
    return Object
        .keys(commands)
        .find(key => commands[key] === command);
}


function calculateChecksum(data) {
    // Magic Checksum starts with 0xEF
    var result = 0xEF;
    for (var i = 0; i < data.length; i++) {
        result ^= data[i];
    }
    return result;
}

const SYNC_FRAME = new Uint8Array([0x07, 0x07, 0x12, 0x20,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]);

function determineNumBlocks(blockSize, length) {
    return Math.floor((length + blockSize - 1) / blockSize);
}

function sync() {
    return prepareCommand(commands.SYNC_FRAME, SYNC_FRAME, {
        timeout: 200
    });
}

function flashBegin(address, size) {
    const numBlocks = determineNumBlocks(FLASH_BLOCK_SIZE, size);
    const numSectors = Math.floor((size + SECTOR_SIZE - 1) / SECTOR_SIZE);
    const startSector = Math.floor(address / SECTOR_SIZE);
    // Leave some room for header space
    let headSectors = SECTORS_PER_BLOCK - (startSector % SECTORS_PER_BLOCK);
    if (numSectors < headSectors) {
        headSectors = numSectors;
    }
    let eraseSize = (numSectors - headSectors) * SECTOR_SIZE;
    // TODO:csd - Research this...
    /* SPIEraseArea function in the esp8266 ROM has a bug which causes extra area to be erased.
        If the address range to be erased crosses the block boundary,
        then extra head_sector_count sectors are erased.
        If the address range doesn't cross the block boundary,
        then extra total_sector_count sectors are erased.
    */
    if (numSectors < (2 * headSectors)) {
        eraseSize = ((numSectors + 1) / 2) * SECTOR_SIZE;
    }
    const buffer = new ArrayBuffer(16);
    var dv = new DataView(buffer);
    dv.setUint32(0, eraseSize, true);
    dv.setUint32(4, numBlocks, true);
    dv.setUint32(8, FLASH_BLOCK_SIZE, true);
    dv.setUint32(12, address, true);
    return prepareCommand(commands.FLASH_BEGIN, new Buffer(buffer));
}

function flashAddress(address, data, flashInfo) {
    const numBlocks = determineNumBlocks(FLASH_BLOCK_SIZE, data.byteLength);
    const requests = [];
    for (let seq = 0; seq < numBlocks; seq++) {
        const startIndex = seq * FLASH_BLOCK_SIZE;
        const endIndex = Math.min((seq + 1) * FLASH_BLOCK_SIZE, data.byteLength);
        let block = data.slice(startIndex, endIndex);
        // On the first block of the first sequence, override the flash info...
        if (address === 0 && seq === 0 && block[0] === 0xe9) {
            // ... which lives in the 3rd and 4th bytes
            // TODO:  This looks different in the new esptool.py
            block[2] = flashInfo.flashMode;
            block[3] = flashInfo.flashSize;
        }
        // On the last block
        if (endIndex === data.byteLength) {
            // Pad the remaining bits
            const padAmount = FLASH_BLOCK_SIZE - block.byteLength;
            const filler = new Uint8Array(padAmount);
            filler.fill(0xFF);
            block = bufferConcat(block, filler);
        }
        const header = new ArrayBuffer(16);
        const dv = new DataView(header);
        dv.setUint32(0, block.byteLength, true);
        dv.setUint32(4, seq, true);
        dv.setUint32(8, 0, true);  // Uhhh
        dv.setUint32(12, 0, true);  // Uhhh
        requests.push(bufferConcat(header, block));
    }
    return requests.map(req => prepareCommand(commands.FLASH_DATA, new Buffer(req), {}));
}

function flashFinish(reboot) {
    const buffer = new ArrayBuffer(4);
    const dv = new DataView(buffer);
    // FIXME:csd - That inverted logic is correct...probably a better variable name than reboot
    dv.setUint32(0, reboot ? 0 : 1, true);
    return prepareCommand(commands.FLASH_DONE, buffer);
}

function readRegister(address) {
        const buffer = new ArrayBuffer(4);
        const dv = new DataView(buffer);
        dv.setUint32(0, address, true);
        return prepareCommand(commands.READ_REGISTER, new Buffer(buffer));
}

function bufferConcat(buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

/**
 * Send appropriate C struct header along with command as required
 * SEE:  https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.h#L49
 */
function headerPacketFor(command, data) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    let checksum = 0;
    if (command === commands.FLASH_DATA) {
        // There are additional headers here....
        checksum = calculateChecksum(data.slice(16));
    } else if (command === commands.FLASH_DONE) {
        // Nothing to see here
    } else {
        // Most commands want the checksum of the entire data packet
        checksum = calculateChecksum(data);
    }
    dv.setUint8(0, 0x00); // Direction, 0x00 is request
    dv.setUint8(1, command); // Command, see commands constant
    dv.setUint16(2, data.byteLength, true); // Size of request
    dv.setUint32(4, checksum, true);
    return buf;
}

function prepareCommand(command, data, options) {
    const sendHeader = headerPacketFor(command, data);
    const message = bufferConcat(sendHeader, data);
    return Object.assign({
        commandCode: command,
        data: slip.encode(message),
        timeout: 3000,
        validate: body => body[0] === 0x00 && body[1] === 0x00
    }, options);
}

// NOTE: Data needs to be slip decoded
function toResponse(data) {
    if (data.byteLength < 8) {
        log.error("Missing header, throwing error");
        throw Error('Missing header');
    }
    const dv = new DataView(data.buffer);
    const header = {
        direction: dv.getUint8(0),
        command: dv.getUint8(1),
        // NOTE: Little Endian represented by true here
        size: dv.getUint16(2, true),
        checksum: dv.getUint32(4, true)
    };

    // If it is not marked as a response
    if (header.direction != 0x01) {
        log.error("Invalid direction, throwing error", header.direction);
        throw Error(`Invalid direction: ${header.direction}`);
    }
    return {
        commandCode: header.command,
        header: header,
        // Lose the header (first 8 bytes)
        body: data.slice(8, 8 + header.size)
    };
}

module.exports = {
    toResponse: toResponse,
    sync: sync,
    flashBegin: flashBegin,
    flashAddress: flashAddress,
    flashFinish: flashFinish,
    readRegister: readRegister,
    FLASH_BLOCK_SIZE: FLASH_BLOCK_SIZE
};
