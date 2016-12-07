"use strict";
const fs = require("fs");
const Rx = require("rxjs/Rx");
const log = require("../../logger");
const Device = require('./device');
const SerialComm = require('./serial');

const device = Device({
    //port: "/dev/cu.wchusbserial1420",
    //port: "/dev/cu.SLAB_USBtoUART"
    comm: SerialComm({
        port: "/dev/cu.SLAB_USBtoUART",
        baudRate: 460800
    })

});

/*

"flash": [
    {
      "address": "0x0000",
      "path": "espruino_1v85_esp8266/boot_v1.4(b1).bin"
    },
    {
      "address": "0x1000",
      "path": "espruino_1v85_esp8266/espruino_esp8266_user1.bin"
    },
    {
      "address": "0x3FC000",
      "path": "espruino_1v85_esp8266/esp_init_data_default.bin"
    },
    {
      "address": "0x3FE000",
      "path": "espruino_1v85_esp8266/blank.bin"
    }

*/




device.open((err) => {
    if (err) log.error(err);
    device.flash([
      {'address': '0x0000', buffer: fs.readFileSync('tmp/boot_v1.4(b1).bin')},
      {'address': '0x1000', buffer: fs.readFileSync('tmp/espruino_esp8266_user1.bin')},
      {'address': '0x3FC000', buffer: fs.readFileSync('tmp/esp_init_data_default.bin')},
      {'address': '0x3FE000', buffer: fs.readFileSync('tmp/blank.bin')}
    ]);
});
