# Denke Note

A simple web app to serve Markdown documents.

## Usage

On an empty directory, create a `server.js` file with this:

```js
    var dn = require('denkenote');
    dn.start({
        content: 'src/'
    });
```

This will serve the Markdown files on the `src` folder. You can save a simple markdown `example.md` there:

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

Then you start the server `node server.js` and go to the url printed on the console (something like `localhost:8800/`).

## How it works

Denke Note will search the `content` folder for `.md` files. It reads the files content and splits them using the `headerDivider` string. The first part loaded as a YAML object with `title`, `client`, `url`, `date`, `project` and `version`. The second part is parsed using `marked`. It also creates tokens to client and the document.

## Config

```js
    var dn = require('denkenote');
    
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
        // If true enables a link to download the documents on PDF
        pdf: false
    }); 
```