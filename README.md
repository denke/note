# Denke Note

A simple web app to serve Markdown documents.

## Setup

Install with npm: 

    > npm install -g denke-note

Run on the command line:

    > dnote serve # This serves the Markdown files on the current folder
    > dnote serve content # This serves the Markdown files on the `content` folder

## Folder Structure

The suggested structure is this:

```
docs/ 
├── 0-setting up
├── 1-overview
├── 2-examples
└── 3-tutorial
```

Serve documents like this:

```
me@denke:~/project/docs$ dnote serve

or

me@denke:~$ dnote serve project/docs
```

## Markdown File

 and it subfolders we expect to find files (grouped with directories) such as this one:

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

### Links

Link text is delimited by [square brackets].
 
To create a link, use a second set of square brackets immediately after the link text’s closing square bracket. Inside this second set, place a label of your choosing to identify the link. For example:
 
This is `[an example][id]` reference-style link that is rendered like this: [an example][id].
 
Then, atthe end of the document, you define your link label like this, on a line by itself:
 
```
[id]: http://denke.com.br/
```
 
If your link references another document, define your label as `{category}/{filename}`:
 
```
[id]: development/conventions.md
```
 
If your link references another document's heading (a very specific information), define your label as `{category}/{filename}#heading-id`. Like this:
 
```
[id]: development/conventions.md#code-style-conventions
```
 
If you have a heading such as:
 
```
## Code Stye Conventions
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
```