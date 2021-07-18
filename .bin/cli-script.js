#!/usr/bin/env node

"use strict";

const { existsSync, statSync } = require("fs");
const parseArgs = require("minimist");
const { createServer } = require("net");
const { resolve } = require("path");
const { exit } = require("process");
const { createInterface } = require("readline");
const open = require('../lib/openBrowser')
let staticServer = require("../lib/server");


let options, server;

let rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * make sure that the user really wants to start the server with an address that might not work
 * @param {object} options
 * @param {Interface} rl
 * @param {CallableFunction} callback
 */
async function inquireHost(options, rl, callback) {
    if (!isValidHost(options)) {
        rl.question(options.host + " is invalid, enter a new one (127.0.0.1)", (host) => {
            if (host == "") {
                options.host = "127.0.0.1";
                rl.close();
                callback(options);
            } else {
                inquireHost({...options, host }, rl, callback);
            }
        });
    } else if (options.host !== "localhost" && options.host !== "127.0.0.1") {
        rl.question("are you sure you want to bind on " + options.host + " ? [Y/n](Y) : ", (answer) => {
            if (["", "Y", "y", "yes", "YES"].indexOf(answer) != -1) {
                rl.close();
                callback(options);
            } else if (["", "N", "n", "no", "NO"].indexOf(answer) != -1) {
                rl.question("enter new host (127.0.0.1) ", (host) => {
                    if (host == "") {
                        options.host = "127.0.0.1";
                        rl.close();
                        callback(options);
                    } else {
                        inquireHost({...options, host }, rl, callback);
                    }
                });
            } else {
                console.log("invalid answer !");
                inquireHost(options, rl, callback);
            }
        });
    } else {
        rl.close();
        callback(options);
    }
}

/**
 * check if the host is valid
 * @param {object} options
 */
function isValidHost(options) {
    if (options.host !== "localhost" && !options.host.match(/[0-9]{1,3}(?:\.[0-9]{1,3}){3}/g)) {
        return false;
    } else if (options.host.match(/[0-9]{1,3}(?:\.[0-9]{1,3}){3}/g)) {
        let hasErr = false;
        options.host.split(".").forEach((h) => {
            if (parseInt(h, 10) > 255) {
                hasErr = true;
            }
        });
        return !hasErr;
    } else {
        return true;
    }
}

/**
 * args must be
 *
 *  Args        Alias       defaults        types
 *  -----------------------------------------------------
 *  public      t           env.PWD         string
 *  host        b           127.0.0.1       string
 *  port        p           9876            number
 *  verbose     v           false           boolean
 *  reload      r           false           boolean
 *  help        h           false           boolean
 */

/** Constructing options */

(() => {
    let alias = {
        t: "public",
        b: "host",
        p: "port",
        v: "verbose",
        r: "reload",
        h: "help",
    };

    let defaults = {
        public: resolve("./").replace(/\\/g, "/"),
        host: "127.0.0.1",
        port: 9876,
        verbose: false,
        reload: false,
        help: false,
    };

    let args = parseArgs(process.argv.slice(2), { alias });
    let notNamed = args._;
    delete args._;
    let unknownsOptions = [];

    for (let i in args)
        if (i.length === 1 && alias[i] == undefined) unknownsOptions.push(i);

    for (let i in args)
        if (i.length === 1) delete args[i];

    for (let i in args)
        if (defaults[i] == undefined) unknownsOptions.push(i);

    if (notNamed.length > 1) {
        console.log("unknown parameters");
        displayHelp(2);
    }
    if (unknownsOptions.length > 0) {
        console.log("unknowns options " + unknownsOptions.join(" , "));
        displayHelp(2);
    }

    if (notNamed[0] && !args.public) {
        let t = resolve("./", notNamed[0]).replace(/\\/g, "/");
        if (!existsSync(t) || !statSync(t).isDirectory()) {
            console.log(`${t} is not a directory `);
            exit(1);
        }

        args.public = t;
    }

    options = {...defaults, ...args };

    if (typeof options.port == "boolean" || isNaN(parseInt(options.port, 10))) {
        console.log("the port must be a number");
        exit(1);
    }

    if (!isValidHost(options)) {
        console.log(options.host);
        console.log("the host must be localhost or a valid IPV4 ip address");
        exit(1);
    }

    if (typeof options.reload !== "boolean" || typeof options.verbose !== "boolean" || typeof options.help !== "boolean") {
        console.log("invalid option ");
        displayHelp(1);
    }
})();

function displayHelp(code = 0) {
    let help_doc = `
Usage: dev-server [public_directory] [options]

options:
  -t, --public public_directory   the root directory of the development server
  -b, --host ip_address           the ip address to bind on
  -p, --port port                 the TCP port to listen to
  -v, --verbose                   specify if the logs will be displayed in the console
  -r, --reload                    indicates that the pages will be refreshed in the browser 
    							  if they are modified or if their dependencies are
  -h, --help                      output usage information
`;

    console.log(help_doc);
    exit(code);
}

if (options.help) {
    displayHelp();
}

/**
 * check if a port is in use and return a random one if so
 * @param {number} port the port to check
 * @param {string} host the address on which we want to check the port
 * @return {number} the requested port if not in use or another randomly tested
 */
const getPort = (port, host) => {
    let random = (m, M) => Math.ceil(Math.random() * (M - m) + m);

    return new Promise((resolve, reject) => {
        let currPort = port;
        let tester = createServer();

        tester.once("listening", () => {
            tester.close();
            resolve(currPort);
        });
        tester.once("error", (err) => {
            if (err.code == "EADDRINUSE") {
                currPort = random(8081, 9090);
                tester.listen(currPort, host);
            }
        });

        tester.listen(currPort, host);
    });
};

/** server genaration */

server = staticServer(options);

inquireHost(options, rl, async(options) => {
    let host = options.host === "127.0.0.1" ? "localhost" : options.host;
    let port = await getPort(options.port, host);

    if (port !== options.port)
        console.log(`port ${options.port} already in use , ${port} will be use instead`);

    server.listen(port, host, () => {
        let address = `http://${host}:${port}`;
        console.log(`the server listening on \x1B[36m${address}\x1B[0m\r\n`);
        try {
            //open(address);
            let o = 5
        } catch (err) {
            console.log("\x1B[33munable to open the default browser .\x1B[0m\r\n")
        }
    });
});