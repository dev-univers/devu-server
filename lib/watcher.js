var recursive = require("recursive-readdir");
const chokidar = require('chokidar');
const { statSync } = require('fs');
const { parse } = require("path");

// One-liner for current directory
//chokidar.watch('.').on('all', (event, path) => {
//  console.log(event, path);
//});

recursive("./demo", function(err, files) {

    let folders = files.map(f => parse(f).dir).filter((f, i, arr) => !arr.slice(0, i).includes(f))

    chokidar.watch('./demo').on('all', (event, path) => {
        console.log(event, path);
    });

});