'use strict';

/* 
 * Require dependencies
 */
var Hapi = require('hapi'),
    Path = require('path'),
    glob = require('glob'),
    os = require('os'),
    watch = require('node-watch'),
    fs = require('fs'),
    util = require('util'),
    fm = require('front-matter'),
    moment = require('moment'),
    mime = require('mime'),
    marked = require('marked'),
    portfinder = require('portfinder'),
    htmlpdf = require('html-pdf'),
    Handlebars = require('handlebars'),
    _ = require('lodash'),
    shorthash = require('shorthash');

/* 
 * Default variables
 */
var posts,
    posts_backup,
    sorted = false,
    server_uri = '',
    renderer = new marked.Renderer(),
    config = {
        stealth: false,
        port: process.env.port || 8800,
        baseUrl: '',
        salt: '',
        content: process.cwd(),
        pdf: true,
        dateFormat: 'YYYY-MM-DD hh:mm:ss z',
        showCategories: true
    };

/*
 * Custom renderer to parse local links
 */
renderer.link = function(href, title, text) {
    if (href.indexOf('http') == -1) {
        href = internals.server_uri + '/' + Path.dirname(href) + '/' + shorthash.unique(config.salt + Path.join(config.content, href));
    }
    if (this.options.sanitize) {
        try {
            var prot = decodeURIComponent(unescape(href))
                .replace(/[^\w:]/g, '')
                .toLowerCase();
        } catch (e) {
            return '';
        }
        if (prot.indexOf('javascript:') === 0) {
            return '';
        }
    }
    var out = '<a href="' + href + '"';
    if (title) {
        out += ' title="' + title + '"';
    }
    out += '>' + text + '</a>';
    return out;
};

/*
 * handlebar helper to display category names
 */
Handlebars.registerHelper('category_name', function() {
    try {
        var name = Handlebars.escapeExpression(this).split('-')[1];
        return new Handlebars.SafeString(
            name.charAt(0).toUpperCase() + name.slice(1)
        );
    } catch (e) {
        return new Handlebars.SafeString('');
    }
});

/*
 * handlebar helper to display the active post
 */
Handlebars.registerHelper('active_post', function(i1, i2, options) {
    if (i1 == i2) {
        return options.fn(this);
    }
    return options.inverse(this);
});

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
    post.token = shorthash.unique(config.salt + filename);
    post.attributes.token = post.token;
    post.attributes.mtime = moment(fstatus.mtime).format(config.dateFormat);
    post.attributes.ctime = moment(fstatus.ctime).format(config.dateFormat);
    if (!post.attributes.url) {
        post.attributes.url = post.token;
    }
    return {
        metadata: post.attributes,
        raw: post.body,
        text: marked(post.body, {
            renderer: renderer
        }),
        token: post.token,
        filename: filename
    };
};

internals.findPost = function(category, url) {
    var context = {};
    context.baseUrl = config.baseUrl;
    context.showCategories = config.showCategories;
    context.pdf = config.pdf;
    if (category) {
        context.cat = category;
        context.cindex = _.indexOf(posts.categories, context.cat);
        if (context.cindex == -1) {
            return {};
        }
    } else {
        context.cindex = 0;
        context.cat = posts.categories[context.cindex];
    }
    context.posts = posts.files[context.cat];
    context.categories = posts.categories;
    if (posts.categories.length <= 1) {
        context.showCategories = false;
    }
    // If this is a permalink to a post, we need to handle the URL changes
    if (url) {
        context.pindex = _.indexOf(_.pluck(_.pluck(context.posts, 'metadata'), 'token'), url);
        context.baseUrl = '../../../';
        if (context.pindex == -1) {
            // it wasnt a token, but it may be a custom url
            context.pindex = _.indexOf(_.pluck(_.pluck(context.posts, 'metadata'), 'url'), url);
            if (context.pindex == -1) {
                return {};
            }
        }
    }
    if (!context.pindex) {
        context.pindex = 0;
    }
    return context;
}

/* 
 * Request handler to display a list of posts
 */
internals.list = function(request, reply) {
    var context = internals.findPost(request.params.category, request.params.url);
    if (context == {}) {
        return reply.view('404', context);
    }
    return reply.view('index', context);
};

/* 
 * Request handler to print a post on a PDF
 */
internals.printPDF = function(request, reply) {
    var context = internals.findPost(request.params.category, request.params.url);
    if (context == {}) {
        return reply.view('404', context);
    }
    try {
        var filename = Path.join(os.tmpdir(), request.params.category + '-' + request.params.url + ".pdf");
        var templatePdf = fs.readFileSync(Path.join(__dirname, '../templates/pdf.html'), 'utf8');
        var css = fs.readFileSync(Path.join(__dirname, '../static/bs.min.css'), 'utf8');
        var template = Handlebars.compile(templatePdf);
        htmlpdf.create(template({
            css: css,
            text: context.posts[context.pindex].text
        }), {
            "format": "A4",
            "orientation": "portrait",
            "border": "1cm",
            "filename": filename
        }, function(error, buffer) {
            if (error) {
                return reply.view('pdfError');
            } else {
                console.log('Printed a PDF: ', filename);
                return reply.file(filename, {
                    filename: request.params.category + request.params.url + ".pdf",
                    mode: 'attachment'
                });
            }
        });
    } catch (e) {
        return reply.view('pdfError');
    }
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
            path: listpath + '{category}/{url}',
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: listpath,
            handler: internals.list
        });

        server.route({
            method: 'GET',
            path: '/static/files/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../static')
                }
            }
        });

        if (config.pdf) {
            server.route({
                method: 'GET',
                path: listpath + 'print/pdf/{category}/{url}',
                handler: internals.printPDF
            });
        }

        server.start(function(err) {
            internals.server_uri = server.info.uri;
            console.log(internals.server_uri);
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
