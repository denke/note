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
    colors = ["#1ABC9C", "#2ECC71", "#34495E", "#F1C40F", "#3498DB", "#C0392B", "#9B59B6", "#8E44AD", "#ECF0F1", "#F39C12", "#2C3E50", "#16A085", "#2980B9", "#E67E22", "#D35400", "#E74C3C", "#27AE60", "#BDC3C7", "#95A5A6"],
    config = {
        stealth: false,
        port: process.env.port || 8800,
        baseUrl: '',
        salt: '',
        content: process.cwd(),
        pdf: false,
        dateFormat: 'YYYY-MM-DD hh:mm:ss z'
    };

/* 
 * Declare an internals object, used to store private functions
 */
var internals = {};

/* 
 * Read a file and process the YAML metadata and Markdown text.
 * Returns a Post object.
 */
internals.getMarkdownFile = function(filename) {
    var post = fm(fs.readFileSync(filename, 'utf8'));
    var fstatus = fs.statSync(filename);
    post.token = shorthash.unique(config.salt + post.attributes.title + moment());
    post.attributes.token = post.token;
    post.attributes.mtime = moment(fstatus.mtime).format(config.dateFormat);
    post.attributes.ctime = moment(fstatus.ctime).format(config.dateFormat);
    return {
        metadata: post.attributes,
        text: marked(post.body),
        token: post.token,
        filename: filename
    };
};

/*
 * handlebar helper to display category names
 */
Handlebars.registerHelper('category_name', function() {
    var name = Handlebars.escapeExpression(this).split('-')[1];
    return new Handlebars.SafeString(
        name.charAt(0).toUpperCase() + name.slice(1)
    );
});

/*
 * handlebar helper to display the active class
 */
Handlebars.registerHelper('active_class', function(i1, i2, options) {
    if (i1 == i2) {
        return options.fn(this);
    }
    return options.inverse(this);
});

/* 
 * Request handler to display a list of posts
 */
internals.list = function(request, reply) {
    var context = {};
    context.baseUrl = config.baseUrl;
    if (request.params.category) {
        context.cat = request.params.category;
        context.cindex = _.indexOf(posts.categories, context.cat);
    } else {
        context.cindex = 0;
        context.cat = posts.categories[context.cindex];
    }
    context.posts = posts.files[context.cat];
    context.categories = posts.categories;
    if(request.params.token) {
        context.pindex = _.indexOf(_.pluck(_.pluck(context.posts,'metadata'),'token'),request.params.token);
        context.baseUrl = '../../../';
    } 
    if(!context.pindex || context.pindex == -1) {
        context.pindex = 0;
    }
    return reply.view('index', context);
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
    var pdf = template({});

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
            path: listpath + '{category}',
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: listpath + '{category}/{token}',
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: listpath,
            handler: internals.list
        });

        if (config.pdf) {
            server.route({
                method: 'GET',
                path: listpath + 'p/{token}',
                handler: internals.printPDF
            });
        }

        server.route({
            method: 'GET',
            path: '/bootstrap/js/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../bower_components/bootstrap/dist/js')
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/bootstrap/fonts/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../bower_components/bootstrap/dist/fonts')
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/static/css/{a*}',
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
    posts = {};
    glob("**/*.md", {
        cwd: content
    }, function(error, files) {
        if (error) {
            console.log("error on glob: ", error);
        }
        files = _.filter(files, function(file) {
            return Path.basename(file) !== "README.md"
        });
        var p = [];
        _.forEach(files, function(file) {
            if (!p[Path.dirname(file)]) {
                p[Path.dirname(file)] = [];
            }
            p[Path.dirname(file)].push(internals.getMarkdownFile(Path.join(content, file)));
        });
        posts.categories = _.keys(p);
        posts.files = p;
    });
}
exports.processContent = internals.processContent;

/* 
 * Process files and start the server
 */
exports.start = function(c) {
    config = _.defaults(c, config);
    internals.processContent(config.content);
    internals.start();
}

/* 
 * An API to change the logo
 */
exports.logo = function(path) {
    config.logo = base64Image(path);
}

/* 
 * Convert an image to a base64 string
 */
internals.base64Image = function(src) {
    var data = fs.readFileSync(src).toString("base64");
    return util.format("data:%s;base64,%s", mime.lookup(src), data);
}
