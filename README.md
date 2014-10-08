# Denke Note

A simple web app to serve Markdown documents.

## Usage

### Command Line

    denke-note serve -c content/

This will serve the Markdown files on the `content/` folder, inside this folder and it subfolders we expect to find files such as this one:

```markdown
title: My document Title
client: ACME Corp
url: custom-url
date: 05/04/2014
project: Project Name
version: 1.0
--header--

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

* __client__ Documents are grouped by Client
* __url__ You can set a custom url and use it instead of the document ID (hash)
* __project__ Documents belong to a Project
* __title__
* __date__ 
* __version__ 

## How it works

Denke Note will search the `content` folder for `.md` files. It reads the files content and splits them using the `headerDivider` string. The first part loaded as a YAML object with `title`, `client`, `url`, `date`, `project` and `version`. The second part is parsed using `marked`. It also creates tokens to client and the document.

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
    // Directory separator (different on Windows)
    separator: '//',
    // Divide the metadata from the markdown content 
    headerDivider: "--header--",
    // If true enables a link to download the documents on PDF
    pdf: false
}); 
```