# Denke Note

A simple web app to serve Markdown documents.

## Install with npm

    > npm install -g denke-note

### Command Line

    > dnote serve 

This will serve the Markdown files on the current folder, inside this folder and it subfolders we expect to find files (grouped with directories) such as this one:

```markdown
---
title: My document Title
url: custom-url
---

# Some Markdown content here

__Input:__

* Mês
* Ano
```

### API 

On an empty directory, create a `server.js` file with this:

```js
var note = require('denke-note');
note.start({
    content: 'src/'
});
```

This will serve the Markdown files on the `src` folder. You can save a simple markdown `example.md` as above. 

Then you start the server `node server.js` and go to the url printed on the console (something like `localhost:8800/`).

### Metadata

* __title__ Your document title.

## How it works

Denke Note will search the `content` folder for `.md` files. It reads the files content and parse the `front-matter` metadata. 

Denke Note will print the URL for which your files are being served. You can hide your files using the `stealth` option described next.

## Config

```js
var note = require('denke-note');


function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)}; // this awesomeness comes from here: https://gist.github.com/jed/982883

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
```