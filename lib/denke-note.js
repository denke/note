'use strict';
/* 
 * Require dependencies
 */
var Hapi = require('hapi'),
    Path = require('path'),
    glob = require('glob'),
    os = require('os'),
    init = require('init-package-json'),
    ncp = require('ncp'),
    watch = require('node-watch'),
    fs = require('fs'),
    util = require('util'),
    fm = require('front-matter'),
    moment = require('moment'),
    marked = require('marked'),
    portfinder = require('portfinder'),
    htmlpdf = require('html-pdf'),
    Handlebars = require('handlebars'),
    _ = require('lodash'),
    shorthash = require('shorthash'),
    dnoteInfo = require(Path.join(__dirname, '../package.json'));
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
        pageTitle: 'Denke Note',
        content: process.cwd(),
        outputPath: process.cwd(),
        outputDir: '_dnote',
        pdf: true,
        saved: false,
        dateFormat: 'YYYY-MM-DD hh:mm:ss z',
        showCategories: true,
        showRelatedLinks: true
    };
/*
 * Custom `marked` renderer to parse local links.
 *
 * @param {String} href
 * @param {String} title
 * @param {String} text
 */
renderer.link = function(href, title, text) {
    if (href.indexOf('http') == -1) {
        var lid,
            fileCategory,
            baseLink;
        if (href.indexOf('#') != -1) {
            if (href.charAt(0) != '#') {
                baseLink = href.split('#')[0];
                lid = '#' + href.split('#')[1];
                fileCategory = internals.sanitizeCategory(baseLink);
                if (config.saved) {
                    href = './' + fileCategory + '-' + shorthash.unique(config.salt + Path.join(config.content, baseLink)) + '.html' + lid;
                } else {
                    href = internals.server_uri + '/' + fileCategory + '/' + shorthash.unique(config.salt + Path.join(config.content, baseLink)) + lid;
                }
            }
        } else {
            fileCategory = internals.sanitizeCategory(href);
            baseLink = href;
            if (config.saved) {
                href = './' + fileCategory + '-' + shorthash.unique(config.salt + Path.join(config.content, baseLink)) + '.html';
            } else {
                href = internals.server_uri + '/' + fileCategory + '/' + shorthash.unique(config.salt + Path.join(config.content, baseLink));
            }
        }
    }
    if (this.options.sanitize) {
        try {
            var prot = decodeURIComponent(unescape(href)).replace(/[^\w:]/g, '').toLowerCase();
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
 * Custom `marked` renderer to include permalinks on headings.
 *
 * @param {String} text
 * @param {Number} level
 */
renderer.heading = function(text, level) {
    var escapedText = text.toLowerCase().replace(/[^\w]/g, '-');
    var id = escapedText;
    return '<h' + level + ' id="' + id + '">' + text + '<a href="#' + id + '" class="headerlink"><i class="ion-link"></i></a></h' + level + '>';
};
/*
 * Custom `marked` renderer to parse tables.
 *
 * @param {String} header
 * @param {String} body
 */
renderer.table = function(header, body) {
    return '<table class="table table-striped">\n'
    + '<thead>\n'
    + header
    + '</thead>\n'
    + '<tbody>\n'
    + body
    + '</tbody>\n'
    + '</table>\n';
};
/*
 * Custom `marked` renderer to parse images.
 *
 * @param {String} href
 * @param {String} title
 * @param {String} text
 */
renderer.image = function(href, title, text) {
    var out = '<div class="img-wrap">';
    out += '<img src="' + href + '" alt="' + text + '"';
    if (title) {
        out += ' title="' + title + '"';
    }
    out += this.options.xhtml ? '/>' : '>';
    out += '<p><small><em>' + text + '</em></small></p>'
    out += '</div>';
    return out;
};
/*
 * handlebar helper to display category names.
 */
Handlebars.registerHelper('category_name', function() {
    try {
        var name = Handlebars.escapeExpression(this).split('-')[1];
        return new Handlebars.SafeString(name.charAt(0).toUpperCase() + name.slice(1));
    } catch (e) {
        return new Handlebars.SafeString('');
    }
});
/*
 * handlebar helper to display category names.
 */
Handlebars.registerHelper('date_from_now', function(d) {
    try {
        var date = Handlebars.escapeExpression(d);
        return new Handlebars.SafeString(moment(date, config.dateFormat).fromNow());
    } catch (e) {
        return new Handlebars.SafeString(d);
    }
});
/*
 * handlebar helper to display the active post.
 */
Handlebars.registerHelper('active_post', function(i1, i2, options) {
    if (i1 == i2) {
        return options.fn(this);
    }
    return options.inverse(this);
});
/* 
 * Declare an internals object, used to store private functions.
 */
var internals = {};
/* 
 * Read a file and process the YAML metadata and Markdown text.
 * Returns a Post object.
 *
 * @param {String} filename
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
/* 
 * Filter a post by category and URL (optional).
 * Returns a context object used to render the `index.html` template.
 *
 * @param {String} category
 * @param {String} url
 */
internals.findPost = function(category, url) {
    var context = {};
    context.pageTitle = config.pageTitle;
    context.saved = config.saved;
    context.baseUrl = config.baseUrl;
    context.showCategories = config.showCategories;
    context.showRelatedLinks = config.showRelatedLinks;
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
};
/* 
 * HAPI Request handler to display the main Denke Note webpage.
 *
 * @param {Object} request
 * @param {Object} reply
 */
internals.getPosts = function(request, reply) {
    var context = internals.findPost(request.params.category, request.params.url);
    if (context == {}) {
        return reply.view('404', context);
    }
    return reply.view('index', context);
};
/* 
 * HAPI Request handler to download a post as a PDF file.
 *
 * @param {Object} request
 * @param {Object} reply
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
};
/* 
 * Start the HAPI server.
 *
 * @param {Object} config
 */
internals.start = function(config) {
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
            handler: internals.getPosts
        });
        server.route({
            method: 'GET',
            path: listpath + '{category}/{url}',
            handler: internals.getPosts
        });
        server.route({
            method: 'GET',
            path: listpath,
            handler: internals.getPosts
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
        server.route({
            method: 'GET',
            path: '/libs/bootstrap/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../bower_components/bootswatch-dist')
                }
            }
        });
        server.route({
            method: 'GET',
            path: '/libs/ionicons/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../bower_components/ionicons')
                }
            }
        });
        server.route({
            method: 'GET',
            path: '/libs/jquery/{a*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, '../bower_components/jquery/dist')
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
            internals.processContent(function() {
                console.log('Denke Note is serving your files at: ', internals.server_uri);
            });
        });
        watch(config.content, {
            recursive: true,
            followSymLinks: true
        }, function(filename) {
            console.log(filename, ' changed.');
            internals.processContent(function() {
                console.log('Denke Note updated your files at: ', internals.server_uri);
            });
        });
    });
};
/* 
 * Process the markdown files from the content folder.
 *
 * @param {Function} callback
 */
internals.processContent = function(callback) {
    // clear the memory, but store the last 
    posts_backup = _.clone(posts);
    posts = {};
    glob("**/*.md", {
        cwd: config.content
    }, function(error, files) {
        if (error) {
            console.log("error on glob: ", error);
        }
        files = _.filter(files, function(file) {
            return Path.basename(file) != "README.md" && file.indexOf(config.outputDir) == -1
        });
        var p = [];
        _.forEach(files, function(file) {
            var fileCategory = internals.sanitizeCategory(file);
            if (!p[fileCategory]) {
                p[fileCategory] = [];
            }
            p[fileCategory].push(internals.getMarkdownFile(Path.join(config.content, file)));
        });
        posts.categories = _.keys(p);
        posts.files = p;
        if (callback) {
            return callback();
        }
    });
};
/* 
 * Sanitize the folder/filename structure to become category/post.
 *
 * @param {String} filePath
 */
internals.sanitizeCategory = function(filePath) {
    var fileCategory = Path.dirname(filePath);
    if (fileCategory == '.') {
        fileCategory = '@';
    }
    return fileCategory;
};
/* 
 * Public API to process files and start a webserver.
 *
 * @param {Object} _config
 */
exports.start = function(_config) {
    config = _.defaults(_config, config);
    internals.start(config);
};
/* 
 * Public API to process files and save a static website from their contents.
 *
 * @param {Object} _config
 */
exports.save = function(_config) {
    config = _.defaults(_config, config);
    config.saved = true;
    config.baseUrl = './';
    config.pdf = false;
    internals.processContent(internals.save);
};
internals.save = function() {
    if (fs.existsSync(Path.join(config.outputPath, config.outputDir))) {
        rimraf(Path.join(config.outputPath, config.outputDir), function(err) {
            if (err) {
                throw err;
            }
        });
    }
    fs.mkdir(Path.join(config.outputPath, config.outputDir), function(err) {
        if (err) throw err;
        var templateRaw = fs.readFileSync(Path.join(__dirname, '../templates/index.html'), 'utf8');
        var template = Handlebars.compile(templateRaw);
        for (var i = posts.categories.length - 1; i >= 0; i--) {
            var category = posts.categories[i];
            var ps = posts.files[category];
            for (var j = ps.length - 1; j >= 0; j--) {
                var url = ps[j].metadata.url;
                var context = internals.findPost(category, url);
                var html = template(context);
                fs.writeFile(Path.join(config.outputPath, config.outputDir, category + '-' + context.posts[context.pindex].metadata.token + '.html'), html, function(err) {
                    if (err) throw err;
                });
                if (j == 0) {
                    fs.writeFile(Path.join(config.outputPath, config.outputDir, category + '.html'), html, function(err) {
                        if (err) throw err;
                    });
                };
            };
        };
        fs.mkdirSync(Path.join(config.outputPath, config.outputDir, 'static'));
        fs.mkdirSync(Path.join(config.outputPath, config.outputDir, 'static', 'files'));
        ncp(Path.join(__dirname, '../static/'), Path.join(config.outputPath, config.outputDir, 'static', 'files'));
    });
};
/* 
 * Scaffold a new markdown project
 *
 * @param {Object} _config
 */
exports.new = function(_config) {
    config = _.defaults(_config, config);
    internals.new(config);
};
internals.new = function() {
    ncp(Path.join(__dirname, '../docs/sample/'), Path.join(config.outputPath));
    console.log('Some sample documents have been created at: ', Path.join(config.outputPath));
    console.log('This should help you get started.')
};
/* 
 * Init a new node.js project with Denke Note as a dependency.
 *
 * @param {Object} _config
 */
exports.init = function(_config) {
    config = _.defaults(_config, config);
    internals.init(config);
};
internals.init = function() {
    console.log('This will help you create a new node.js project that uses Denke Note.');
    console.log();
    if(!fs.existsSync(Path.resolve(config.content))) {
        fs.mkdirSync(Path.resolve(config.content));
    }
    init(Path.resolve(config.content), 'file that does not exist', {
        'dependencies': {
            'denke-note': '^' + dnoteInfo.version
        }
    }, function(err, data) {
        if (err) {
            throw err;
        }
        ncp(Path.join(__dirname, '../docs/scaffold/'), Path.resolve(config.content));
        console.log('Project created at: ' + Path.resolve(config.content));
        console.log();
        console.log('You need to run the following commands: ');
        console.log('  $ cd ' + Path.resolve(config.content));
        console.log('  $ npm install');
        console.log();
        console.log('This will install Denke Note and it\'s dependencies.');
        console.log();
        console.log('To start your server just run this command:');
        console.log('  $ node server.js');
        console.log();
    });
};
