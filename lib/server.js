"use strict";
const { createServer, STATUS_CODES } = require("http");
const { parse } = require("url");
const { existsSync, statSync, readFileSync, readFile, createReadStream, watch } = require("fs");
const { resolve, relative } = require("path");
const mime = require("./mime-type");
const io = require("socket.io");
const chokidar = require('chokidar')
const { Readable } = require('stream')
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

    readFile(resolve(__dirname, "../node_modules/socket.io-client/dist/socket.io.min.js"), { encoding: "utf-8" }, (err, data) => {
        if (err) throw err

        let script = `<script >
            (async ()=>{
                ${data}
                const Dependencies = ${JSON.stringify(dependencies)}
                const Main = '${pathname.replace(/^\//, "")}'
                ${readFileSync(resolve(__dirname, "reload-client.js"), {encoding: "utf-8",})}
            })()
        </script>`;

        next(makeReadable(script))

    });

}

function staticServer(options) {
    let log = (msg, show = options.verbose) => {
        if (!show) return;
        let d = new Date().toLocaleString();
        console.log(`[${d}] ${msg}`);
    };

    async function onConnection(req, res) {
        if (req.url == undefined) {
            res.writeHead(403, { 'content-type': 'text/plain' })
            return res.end()
        }
        let { pathname } = parse(req.url);

        let file = resolve(options.public, `.${pathname}`);

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
                `404 not found index.html on ${pathname} ` :
                `${pathname} ${STATUS_CODES["404"]}`;
            res.writeHead(404, { "content-type": "text/plain" });
            res.end(msg);
            log(`${req.method.toLocaleUpperCase()} ${msg}`);
            return;
        }

        res.writeHead(200, { "content-type": mime(file) });

        if (mime(file) === "text/html" && options.reload) {
            enableReaload(file, options.public, stream => {
                let codeStream = createReadStream(file)
                codeStream
                    .on('data', d => res.write(d))
                    .on('end', () => stream.pipe(res))
            });
        } else {
            createReadStream(file).pipe(res)
        }
        log(`${req.method.toLocaleUpperCase()} ${pathname} 200 ${STATUS_CODES["200"]}`);
    }

    server = createServer(onConnection);

    server.on("error", (err) => log(`ERROR / ${err.name} : ${err.message}`));

    if (options.reload) {
        io(server).on("connection", (client) => {

            chokidar.watch(options.public).on('change', (fpath) => {

                client.emit('change', relative(options.public, fpath))
            })
        });
    }

    return server;
}


module.exports = staticServer;