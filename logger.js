"use strict";

const bunyan = require("bunyan");

module.exports = bunyan.createLogger({
    name: "rom-comm"
});