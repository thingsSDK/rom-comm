# ROM Comm

[![Build Status](https://travis-ci.org/thingsSDK/rom-comm.svg?branch=master)](https://travis-ci.org/thingsSDK/rom-comm)
[![codecov](https://codecov.io/gh/thingsSDK/rom-comm/branch/master/graph/badge.svg)](https://codecov.io/gh/thingsSDK/rom-comm)
[![Dependency Status](https://david-dm.org/thingssdk/rom-comm.svg)](https://david-dm.org/thingssdk/rom-comm)
[![devDependency Status](https://david-dm.org/thingssdk/rom-comm/dev-status.svg)](https://david-dm.org/thingssdk/rom-comm#info=devDependencies)


You love your devices, but man can they be finnicky, amirite? Like a good romantic comedy, things will eventually work out...after some
near disasters. You'll look for advice from your friends on how to communicate better with your thing, but sometimes that advice is
impossible to decipher.

We are here to attempt to keep communication with your device as light as a film starring Meg Ryan. There is comfort in how all those
films are the same, right? We want communication with your devices to be just that familiar, and just the same. Who wants to learn all those
incantations and rituals, when you've got better things to be building.

thingsSDK strives to abstract away the barriers to device development. You've got things to do.

## Examples

Here is ROMComm to flash the Espruino runtime onto an Espressif ESP8266 over USB.

```javascript
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
```

This code and more lives in the [examples](examples) folder.

## Supported manufacturers

* [Espressif](http://espressif.com)
  * ESP8266
    * flash
