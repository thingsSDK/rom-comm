"use strict";

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

/**
 * Unpack the response header
 */
function headerPacketFrom(buffer) {
    let header = {};
    header.direction = buffer.readUInt8(0);
    header.command = buffer.readUInt8(1);
    header.size = buffer.readUInt16LE(2);
    header.checksum = buffer.readUInt32LE(4);
    return header;
}

function sendCommand(command, data) {
    let sendHeader = headerPacketFor(command, data);




}

