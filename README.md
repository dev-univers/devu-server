# devu-server

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

help you to easily create a development server with live-reload and live-refresh for your web application

## install
```sh
$ npm install devu-server -g
```

## usage
```
dev-server [public_directory] [options]

options:
  -t, --public public_directory   the root directory of the development server
  -b, --host ip_address           the ip address to bind on
  -p, --port port                 the TCP port to listen to
  -v, --verbose                   specify if the logs will be displayed in the console
  -r, --reload                    indicates that the pages will be refreshed in the browser if they are modified or if their dependencies are
  -h, --help                      output usage information
```

## exemples
* ```sh
  $ devu-server 
  ```
  this will start the development server in the current directory at localhost with 9876 port if not in use
* ```sh
  $ devu-server ./ -p 8080
  ```
  this will start the development server in the current directory at localhost with 8080 port if not in use
* ```sh
  $ devu-server -t /app/root -p 1234 -r
  ```
  this will start the development server in /app/root directory at localhost with 1234 port if not in use and live-reload enabled

## installation note

this module depends among other things on [@parcel/watcher](https://github.com/parcel-bundler/watcher#readme) which is a native module allowing to efficiently watch file modifications in various os in order to offer a quality live-reload.
You will therefor need to have the [node build tools](https://github.com/nodejs/node-gyp#readme) installed for it to be build an install correctly during the installation of devu-server