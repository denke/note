# Denke Note

A simple web app to serve Markdown documents.

## Usage

### Command Line

    > dnote serve content/

This will serve the Markdown files on the `content/` folder, inside this folder and it subfolders we expect to find files such as this one:

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
* __url__ You can set a custom url and use it to group documents (optional)

## How it works

Denke Note will search the `content` folder for `.md` files. It reads the files content and splits them using `front-matter`. And we use `marked` to parse the markdown content.

Denke Note will print the URL for which your files are being served. You can hide your files using the `stealth` option described next.

## Config

```js
var note = require('denke-note');

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
    salt: 'uita+kap.pa8hae7*' 
    // If true enables a link to download the documents on PDF
    pdf: false
}); 
```