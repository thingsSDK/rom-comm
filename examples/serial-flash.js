"use strict";

const fs = require('fs');
const ROMComm = require('..');

const portName = '/dev/cu.SLAB_USBtoUART';
const serialOptions = {
    baudRate: 460800
};
const device = ROMComm.serial(portName, serialOptions);

device.open((err) => {
    device.flash([
      {'address': '0x0000', buffer: fs.readFileSync('examples/tmp/boot_v1.4(b1).bin')},
      {'address': '0x1000', buffer: fs.readFileSync('examples/tmp/espruino_esp8266_user1.bin')},
      {'address': '0x3FC000', buffer: fs.readFileSync('examples/tmp/esp_init_data_default.bin')},
      {'address': '0x3FE000', buffer: fs.readFileSync('examples/tmp/blank.bin')}
    ], (err) => {
        console.log('Flashed!');
        device.close();
    });
});