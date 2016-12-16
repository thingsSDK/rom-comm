const espressif = require("../../../manufacturers/espressif");

const portName = '/dev/cu.SLAB_USBtoUART';
const serialOptions = {
    baudRate: 460800
};

const comm = espressif.SerialComm(portName, serialOptions);
const detect = espressif.AutoDetect(comm);
