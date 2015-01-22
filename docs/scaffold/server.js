#!/usr/bin/env node
'use strict';

var note = require('denke-note');

// this awesomeness is from this gist: https://gist.github.com/jed/982883
function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};

note.start({
    // The port to serve the webapp
    port: process.env.port || 8800, 
    // The content folder
    content: 'src/', 
    // You can use a secret URL to hide the post list (example: '/hidden/path/')
    stealth: false, 
    // Use with stealth when the route is changed (example: '../../')
    baseUrl: '', 
    // Salt your hashes
    salt: b(),
    // If true enables a link to download the documents on PDF
    pdf: false
}); 