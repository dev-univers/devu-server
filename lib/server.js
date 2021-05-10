"use strict";
const { createServer, STATUS_CODES } = require("http");
const { parse } = require("url");
const { existsSync, statSync, readFileSync, watch } = require("fs");
const { resolve, relative } = require("path");
const mime = require("./mime-type");
const io = require("socket.io");
const watcher = require('@parcel/watcher')
const fetchDependencies = require("./fetch-dependencies");

let server;

function enableReaload(res, file, reload, root) {
    let dependencies = fetchDependencies(file, root);
    let pathname = file.replace(/\\/g, "/").replace(root.replace(/\\/g, "/"), "");

    if (reload) {
        let script = readFileSync(resolve(__dirname, "../node_modules/socket.io-client/dist/socket.io.min.js"), { encoding: "utf-8" });

        script = `<script >
            (async ()=>{
                ${script}
                const Dependencies = ${JSON.stringify(dependencies)}
                const Main = '${pathname.replace(/^\//, "")}'
                ${readFileSync(resolve(__dirname, "reload-client.js"), {encoding: "utf-8",})}
            })()
        </script>`;

        res.write(`\r\n ${script}`);
    }
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
        res.write(readFileSync(file));
        if (mime(file) === "text/html")
            enableReaload(res, file, options.reload, options.public);
        res.end();
        log(`${req.method.toLocaleUpperCase()} ${pathname} 200 ${STATUS_CODES["200"]}`);
    }

    server = createServer(onConnection);

    server.on("error", (err) => log(`ERROR / ${err.name} : ${err.message}`));

    if (options.reload) {
        io(server).on("connection", (client) => {
            /*let sendded = false;
            setInterval(() => (sendded = false), 2000);
            watch(options.public,{recursive: true},(ev, target) => {
                if (sendded) return;

                client.emit(ev, target);

                sendded = true;
            });*/

            watcher.subscribe(options.public, (err, ev) => {
                if (err) {}

                ev.forEach(action => {
                    client.emit('change', relative(options.public, action.path))
                })
            })
        });
    }

    return server;
}

module.exports = staticServer;