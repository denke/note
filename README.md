# Denke Note

A simple web app to serve Markdown documents.

## Setup

Install with npm:

```
me@denke:~$  npm install -g denke-note
```

## How it works

Denke Note will search the `content` folder for `.md` files. It reads the files content and parse the metadata with `front-matter` and markdown to html with `marked`. 

Unique Tokens are created using `shorthash` and are used as URLs if there's no `url` field on the file metatada. 

Denke Note will print the URL for which your files are being served. You can hide your files using the `stealth` option.

## Folder Structure

The suggested structure is something similar to this:

```
docs/
├─┬ 0-setting up/
│ ├── 0-install.md
│ ├── 1-setup.md
│ ├── 2-faq.md
│ └── 3-settings.md
├─┬ 1-overview/
│ ├── 0-concepts.md
│ ├── 1-architecture.md
│ └── 3-developing.md
└─┬ 2-tutorial/
  ├── 0-how-to-import-data.md
  └── 1-how-to-process-data.md
```

Each folder name is be splited by `'-'`. The first part is expected to be a number representing the category order and the second is the category name. 

## Serving Documents

Serve documents like this:

```
me@denke:~/project/docs$ dnote serve

or

me@denke:~$ dnote serve project/docs
```

## Links

To use links on your files, Link text is delimited by [square brackets].
 
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

## Markdown File Example

* __title__ Your document title.
* __url__ You may choose a custom url to your document.

```
---
title: My Test Document
url: my-test-test
---

# My Test Document

[Now that there is][ts] the Tec-9, a crappy spray gun from South Miami. This gun is advertised as the most popular gun in American crime. Do you believe that shit? It actually says that in the little book that comes with it: the most popular gun in American crime. Like they're actually proud of that shit. 

## We're on the same curve, just on opposite ends

Your bones don't break, mine do. That's clear. Your cells react to bacteria and viruses differently than mine. You don't get sick, I do. That's also clear. But for some reason, you and I react the exact same way to water. We swallow it too fast, we choke. We get some in our lungs, we drown. However unreal it may seem, we are connected, you and I. We're on the same curve, just on opposite ends.

[ts]: ./other.md#you-do-understand
```

## API 

On an empty directory, create a `server.js` file with this:

```js
var note = require('denke-note');
note.start({
    content: 'src/'
});
```

This will serve the Markdown files on the `src` folder. You can save a simple markdown `example.md` as above. 

Then you start the server `node server.js` and go to the url printed on the console (something like `localhost:8800/`).

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