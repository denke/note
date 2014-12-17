'use strict';

/* 
 * Require dependencies
 */
var Hapi = require('hapi'),
    Path = require('path'),
    glob = require('glob'),
    watch = require('node-watch'),
    fs = require('fs'),
    util = require('util'),
    fm = require('front-matter'),
    moment = require('moment'),
    mime = require('mime'),
    marked = require('marked'),
    portfinder = require('portfinder'),
    markdownpdf = require('markdown-pdf'),
    Handlebars = require('handlebars'),
    _ = require('lodash'),
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
        content: process.cwd(),
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
 * Read a file and process the YAML metadata and Markdown text.
 * Returns a Post object.
 */
internals.getMarkdownFile = function(filename) {
    var post = fm(fs.readFileSync(filename, 'utf8'));
    var fstatus = fs.statSync(filename);
    post.token = shorthash.unique(config.salt + post.attributes.title);
    post.attributes.token = post.token; 
    post.attributes.mtime = moment(fstatus.mtime).format('YYYY-MM-DD hh:mm:ss z');
    post.attributes.ctime = moment(fstatus.ctime).format('YYYY-MM-DD hh:mm:ss z'); 
    return {
        metadata: post.attributes,
        text: marked(post.body),
        token: post.token,
        filename: filename
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
            console.log(err);
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
    console.log(content)
    glob("**/*.md", { cwd: content }, function (error, files) {
        if (error) {
            console.log("error on glob: ",error);
        }
        files = _.filter(files, function(file){
            return Path.basename(file) !== "README.md"
        });
        _.forEach(files, function(file){
            posts.push(internals.getMarkdownFile(Path.join(content,file)));
        });
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

