# Denke Note

A simple web app to serve Markdown documents.

## Install 

    npm install denkenote

## Usage 

    var dn = require('./index.js');
    
    dn.start({
        // The port to serve the webapp
        port: process.env.port || 8800, 
        // The content folder
        content: 'src/', 
        // You can use a secret URL to hide the post list (example: '/hidden/path/')
        stealth: false, 
        // Use with stealth when the route is changed (example: '../../')
        baseUrl: '', 
        // Salt your hashes
        salt: 'uita+kap.pa8hae7*' 
        // Directory separator (different on Windows)
        separator: '//',
        // Divide the metadata from the markdown content 
        headerDivider: "--header--",
        // The company logo
        logo: 'img/logo.png',
        port: 
    });

## How it works 

Denke Note will search the `content` folder for `.md` files. It reads the files content and splits them using the `headerDivider` string. The first part loaded as a YAML object with `title`, `client`, `url`, `date`, `project` and `version`. The second part is parsed using `marked`. It also creates tokens to client and the document.