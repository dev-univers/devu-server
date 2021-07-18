/** @This is for reload-client script identification */

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

function sortDepTree(deps, obj, path = '') {
    let find = false

    let findDeps = (deps, obj, path) => {

        if (find) return path

        if (deps.length > 0) {

            deps.forEach(dep => {
                if (dep.file === obj) {
                    path += '/' + dep.file
                    find = true
                } else {
                    let p = path + (find ? '' : '/' + dep.file)
                    path = findDeps(dep.deps, obj, p)
                }
            })

        } else {
            return ''
        }
        return path
    }

    return findDeps(deps, obj, path)
}

function findDepInDom(dep, type) {

    let depNode
    if (type === "styleSheet") {
        Array.from(document.styleSheets).forEach(stl => {
            if (stl.ownerNode.localName === "link") {
                let asset = (new URL(stl.href)).pathname.replace(/^\//, '')

                if (asset == dep) depNode = stl.ownerNode
            } else if (stl.ownerNode.localName === "style") {
                let reg = new RegExp(`url\\(['"]?\\s*${dep.replace(/\\/g,'\\/')}\\s*['"]?\\)`, 'gi')

                if (stl.ownerNode.innerText.match(reg)) depNode = stl.ownerNode
            }
        })
    }
    if (type === "script") {
        Array.from(document.scripts).forEach(elm => {
            if (!elm.src) return

            let asset = (new URL(elm.src)).pathname.replace(/^\//, '')
            if (asset == dep) depNode = elm
        })
    }

    return depNode

}

async function handleChanges(target) {
    if (timer.el < 1) return
    let depTree = sortDepTree(Dependencies, target)
    let dep

    timer.reset()
    if (depTree === '') {
        if (target.replace(/\\/g, '/') == Main) {

            location = location
            return

        } else {
            return
        }
    }


    dep = depTree.split('/')[1].replace(/\\/g, '/')

    if (dep.match(/(\.css)$/gi)) {

        let node = findDepInDom(dep, 'styleSheet')

        if (node && node.localName == "link") node.href = node.href
        if (node && node.localName == "style") node.innerText = node.innerText
    } else {
        location = location
    }

}

let socket = io()
console.log('[..] reload client is connected .')
timer.start()
socket.on('change', handleChanges)
socket.on('connect_error', data => {
    console.log('[..] the reload server was disconnected ')
    socket.disconnect()
})