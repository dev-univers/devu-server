"use strict";
const { createServer, STATUS_CODES } = require("http");
const { parse } = require("url");
const { existsSync, statSync, readFileSync, readFile, createReadStream, watch } = require("fs");
const { resolve, relative } = require("path");
const mime = require("./mime-type");
const io = require("socket.io");
const chokidar = require('chokidar')
const { Readable } = require('stream')
const moment = require('moment')
const fetchDependencies = require("./fetch-dependencies");

let server;

function makeReadable(chunk, encoding) {
    let stream = new Readable()

    stream._read = () => {}
    stream.push(chunk, encoding || 'utf-8')
    stream.push(null)

    return stream
}

function enableReaload(file, root, next) {
    let dependencies = fetchDependencies(file, root);
    let pathname = file.replace(/\\/g, "/").replace(root.replace(/\\/g, "/"), "");

    readFile(resolve(__dirname, "../node_modules/socket.io-client/dist/socket.io.min.js"), 'utf-8', (err, data) => {
        if (err) throw err

        let script = `<script >
            (async ()=>{
                ${data}
                const Dependencies = ${JSON.stringify(dependencies)}
                const Main = '${pathname.replace(/^\//, "")}'
                ${readFileSync(resolve(__dirname,'./reload-client.js'),'utf-8')}
            })()
        /*end*/</script>`;

        next(makeReadable(script))

    });

}

const bg = code => `\x1B[${code||0}m`

function staticServer(options) {
    let log = (msg, show = options.verbose) => {
        if (!show) return;
        let d = moment().format('yyyy-MM-DD H:m:s')
        console.log(`${bg(35)}[${d}] ${msg}`);
    };

    let iomap
    if (options.reload) iomap = '{"version":3,"sources":[],"names":[],"mappings":"","file":"socket.io.js","sourcesContent":[],"sourceRoot":""}'

    async function onConnection(req, res) {
        if (req.url == undefined) {
            res.writeHead(403, { 'content-type': 'text/plain' })
            return res.end()
        }
        let { pathname } = parse(req.url);

        let file = resolve(options.public, `.${pathname}`);
        let isIomap = pathname === '/socket.io.min.js.map'
        if (!existsSync(file)) {
            let refUrl = req.headers.referer
            if (refUrl != undefined) {
                let referer = parse(refUrl).pathname;
                if (existsSync(resolve(options.public, "." + referer, "." + pathname)))
                    file = resolve(options.public, "." + referer, "." + pathname);
            }
        }
        if (existsSync(file) && statSync(file).isDirectory() && existsSync(resolve(file, "index.html"))) {
            file = resolve(file, "index.html");
        }

        if (!existsSync(file) || !statSync(file).isFile()) {
            let msg = existsSync(file) && statSync(file).isDirectory() ?
                `${bg(36)}404 Not Found index.html on ${pathname} ${bg()}` :
                `${pathname} ${bg(31)}404 ${STATUS_CODES["404"]}${bg()}`;
            res.writeHead(isIomap ? 200 : 404, { "content-type": "text/plain" });
            res.end(isIomap ? iomap : msg.replace(/\x1B\[\d+?m/g, ''));
            log(`${bg(36)}${req.method.toLocaleUpperCase()}${bg()} ${isIomap? bg(32)+'200 Ok'+bg():msg}`);
            return;
        }

        res.writeHead(200, {
            "content-type": mime(file),
            "Cache-Control": "no-cache"
        });

        if (mime(file) === "text/html" && options.reload) {
            enableReaload(file, options.public, stream => {
                let codeStream = createReadStream(file)
                stream
                    .on('data', d => res.write(d))
                    .on('end', () => codeStream.pipe(res))
            });
        } else {
            createReadStream(file).pipe(res)
        }
        log(`${bg(36)}${req.method.toLocaleUpperCase()}${bg()} ${pathname} ${bg(32)}200 ${STATUS_CODES["200"]}${bg()}`);
    }

    server = createServer(onConnection);

    server.on("error", (err) => log(`ERROR / ${err.name} : ${err.message}`));

    if (options.reload) {
        let timer = {
            el: 0,
            t: null,
            start: function(i = 1000) {
                this.t = setInterval(() => this.add(), i)
            },
            add: function(n = 1) {
                this.el += n
            },
            reset: function() {
                this.el = 0
            },
            stop: function() {
                clearInterval(this.t)
                this.t = null
            }
        }
        io(server).on("connection", (client) => {
            //timer.start()
            chokidar.watch(options.public).on('all', (ev, path) => {

                    if ( /*timer.el > 1 &&*/ ev === "change") client.emit('change', relative(options.public, path))
                        //timer.reset()
                })
                //client.on('disconnect', () => timer.stop())
        });

    }

    return server;
}


module.exports = staticServer;