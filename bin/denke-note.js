#!/usr/bin/env node

var colors = require('colors'),
    httpServer = require('../lib/http-server'),
    portfinder = require('portfinder'),
    opener = require('opener'),
    argv = require('optimist')
    .boolean('cors')
    .argv;
if (argv.h || argv.help) {
    console.log([
        "usage: denke-note [path] [options]",
        "",
        "options:",
        " -p Port to use [8800]",
        " -a Address to use [0.0.0.0]",
        "",
        " -h --help Print this list and exit."
    ].join('\n'));
    process.exit();
}
