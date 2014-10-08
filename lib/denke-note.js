'use strict';

/* 
 * Require dependencies
 */
var Hapi = require('hapi'),
    Path = require('path'),
    watch = require('node-watch'),
    fs = require('fs'),
    util = require("util"),
    mime = require("mime"),
    marked = require('marked'),
    portfinder = require('portfinder'),
    markdownpdf = require('markdown-pdf'),
    Handlebars = require('handlebars'),
    _ = require('lodash'),
    yaml = require('js-yaml'),
    shorthash = require('shorthash');

/* 
 * Default variables
 */
var posts = [],
    posts_backup = [],
    sorted = false,
    server_uri = '',
    logo = '',
    config = {
        stealth: false,
        port: process.env.port || 8800,
        baseUrl: '',
        salt: '',
        separator: '/',
        content: "content/",
        headerDivider: "--header--",
        logo: 'img/logo.png',
        pdf: false,
        pdfHeader: '<div style="margin-bottom: 1cm;"><img src="{{logo}}" alt="DENKE"></div>'
    };


/* 
 * Convert an image to a base64 string
 */
function base64Image(src) {
    var data = fs.readFileSync(src).toString("base64");
    return util.format("data:%s;base64,%s", mime.lookup(src), data);
}

/* 
 * Recursive walk through subdirs searching for files
 * and calls the `cb` callback on the results.
 */
var walkDir = function(dir, cb) {
    var results = [];
    fs.readdir(dir, function(err, list) {
        if (err) {
            return cb(err);
        }
        var pending = list.length;
        if (!pending) {
            return cb(null, results);
        }
        list.forEach(function(file) {
            file = dir + '/' + file;
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walkDir(file, function(err, res) {
                        results = results.concat(res);
                        if (!--pending) {
                            cb(null, results);
                        }
                    });
                } else {
                    results.push(file);
                    if (!--pending) {
                        cb(null, results);
                    }
                }
            });
        });
    });
};

/* 
 * Read a file and process the YAML metadata and Markdown text.
 * Returns a Post object.
 */
var getMarkdownFile = function(filename) {
    var c = fs.readFileSync(filename, 'utf8').split(config.headerDivider),
        metadata = yaml.load(c[0]);
    metadata.token = shorthash.unique(config.salt + metadata.date +
        metadata.title + metadata.client + metadata.project);

    return {
        metadata: metadata,
        text: marked(c[1]),
        token: metadata.token,
        filename: filename,
        clientToken: shorthash.unique(config.salt + metadata.client)
    };
};

/* 
 * Declare an internals object, used to store private functions
 */
var internals = {};

/* 
 * Request handler to display a list of posts
 */
internals.list = function(request, reply) {
    if (!sorted) {
        posts = _.sortBy(posts, function(post) {
            return post.date
        });
        sorted = true;
    }

    var context = {
        baseUrl: config.baseUrl,
        logo: config.logo
    };

    if (request.params.clientToken) {
        var token = encodeURIComponent(request.params.clientToken);
        context.baseUrl = '../';
        context.files = _.filter(posts, function(post) {
            return post.clientToken === token || post.metadata.url === token;
        });
    } else {
        context.files = posts;
        context.admin = true;
    }

    return reply.view('index', context);
};

/* 
 * Request handler to display one post
 */
internals.post = function(request, reply) {
    var token = encodeURIComponent(request.params.token);

    var md = _.find(posts, function(post) {
        return post.token === token;
    });

    var context = {
        baseUrl: "../",
        header: md.metadata,
        text: md.text,
        logo: config.logo,
        token: token,
        pdf: config.pdf
    };
    return reply.view('post', context);
};

/* 
 * Request handler to print a post on a PDF
 */
internals.printPDF = function(request, reply) {
    var token = encodeURIComponent(request.params.token);

    var md = _.find(posts, function(post) {
        return post.token === token;
    });

    var template = Handlebars.compile(config.pdfHeader + md.text);
    var pdf = template({
        logo: config.logo
    })

    markdownpdf({
        paperBorder: '2cm'
    }).from.string(pdf).to('files/' + token + '.pdf', function(error) {
        if (error) {
            reply.view('error');
        } else {
            reply.file('files/' + token + '.pdf', {
                filename: token + '.pdf',
                mode: 'attachment'
            });
        }
    });
}

/* 
 * Process files and start the server
 */
internals.start = function() {

    portfinder.getPort(function(err, port) {
        if (err) { return; }

        var server = new Hapi.Server(port);

        server.views({
            engines: {
                html: Handlebars
            },
            path: Path.join(__dirname, '../templates')
        });

        var listpath;
        if (config.stealth) {
            listpath = config.stealth;
        } else {
            listpath = '/';
        }

        server.route({
            method: 'GET',
            path: listpath,
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: '/c/{clientToken}',
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: '/d/{token}',
            handler: internals.post
        });

        if (config.pdf) {
            server.route({
                method: 'GET',
                path: '/p/{token}',
                handler: internals.printPDF
            });
        }

        server.route({
            method: 'GET',
            path: '/{static*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../static')
                }
            }
        });

        server.start(function(err) {
            server_uri = server.info.uri;
            console.log(server_uri);
        });

        watch(config.content, {
            recursive: true,
            followSymLinks: true
        }, function(filename) {
            console.log(filename, ' changed.');
            processContent(config.content);
        });

    });
}

/* 
 * Process files and start the server
 */
exports.start = function(c) {
    config = _.defaults(c, config);
    config.logo = base64Image(Path.join(__dirname, '../static/' + config.logo));
    this.processContent(Path.join('./', config.content));
    internals.start();
}

/* 
 * An API to change the logo
 */
exports.logo = function(path) {
    config.logo = base64Image(path);
}


/* 
 * Process files for the given `content`
 */
function processContent(content) {
    // clear the memory, but store the last 
    posts_backup = _.clone(posts);
    posts = [];
    walkDir(content, function(error, results) {
        if (error) {
            console.log(error);
        } else {
            for (var i = results.length - 1; i >= 0; i--) {
                var r = Path.resolve(results[i]);
                posts.push(getMarkdownFile(r));
            }
        }
    });
}
exports.processContent = processContent;
