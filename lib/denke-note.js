'use strict';

/* 
 * Require dependencies
 */
var Hapi = require('hapi'),
    Path = require('path'),
    watch = require('node-watch'),
    fs = require('fs'),
    util = require("util"),
    moment = require("moment"),
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
        content: "content/",
        headerDivider: "--header--",
        logo: 'img/logo.png',
        pdf: false,
        pdfHeader: '<div style="margin-bottom: 1cm;"><img src="{{logo}}" alt="DENKE"></div>'
    };

/* 
 * Declare an internals object, used to store private functions
 */
var internals = {};

/* 
 * Convert an image to a base64 string
 */
internals.base64Image = function(src) {
    var data = fs.readFileSync(src).toString("base64");
    return util.format("data:%s;base64,%s", mime.lookup(src), data);
}

/* 
 * Recursive walk through subdirs searching for files
 * and calls the `cb` callback on the results.
 */
internals.walkDir = function(dir, cb) {
    dir = Path.resolve(dir);
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
            file = Path.join(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    internals.walkDir(file, function(err, res) {
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
internals.getMarkdownFile = function(filename) {
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
 * Request handler to display a list of posts
 */
internals.list = function(request, reply) {

    posts = _.sortBy(posts, function(post) {
        return -1*moment(post.metadata.date, "DD/MM/YYYY").unix();
    });

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
    });

    markdownpdf({
        paperBorder: '2cm'
    }).from.string(pdf)
    .to('files/' + token + '.pdf', function(error) {
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
    internals.isWindows = process.platform === 'win32';
    portfinder.basePort = config.port;
    portfinder.getPort(function(err, port) {
        if (err) {
            return;
        }

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
            internals.processContent(config.content);
        });

    });
}

/* 
 * Process files for the given `content`
 */
internals.processContent = function(content) {
    // clear the memory, but store the last 
    posts_backup = _.clone(posts);
    posts = [];
    internals.walkDir(content, function(error, results) {
        if (error) {
            console.log("error on walkdir");
            console.log(error);
        } else {
            for (var i = results.length - 1; i >= 0; i--) {
                var r = results[i];
                posts.push(internals.getMarkdownFile(r));
            }
        }
    });
}
exports.processContent = internals.processContent;

/* 
 * Process files and start the server
 */
exports.start = function(c) {
    config = _.defaults(c, config);
    config.logo = internals.base64Image(Path.join(__dirname, '../static/' + config.logo));
    internals.processContent(config.content);
    internals.start();
}

/* 
 * An API to change the logo
 */
exports.logo = function(path) {
    config.logo = base64Image(path);
}

