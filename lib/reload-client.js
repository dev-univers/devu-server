/** @This is for reload-client script identification */

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
    let depTree = sortDepTree(Dependencies, target)
    let dep

    if (depTree === '') {
        if (target.replace(/\\/g, '/') == Main) {

            let newHTML = (await (await fetch('/' + Main)).text()).replace(/^.+?\<html/gsi, '<html')
            newHTML = newHTML.replace(/\<\/html\>.+/gsi, '</html>')
            let oldHTML = document.querySelector('html').outerHTML
            oldHTML = oldHTML.replace(/\<script\>.+?@This is for reload-client script identification.+?\<\/script\>/gsi, '')


            document.querySelector('html').innerHTML = newHTML
            return

        } else {
            return
        }
    }


    dep = depTree.split('/')[1].replace(/\\/g, '/')

    if (dep.match(/(\.css)$/gi)) {

        let node = findDepInDom(dep, 'styleSheet')
        if (node.localName == "link") node.href = node.href
        if (node.localName == "style") node.innerText = node.innerText
    } else {
        location = location
    }

}

let socket = io()

socket.emit('dependencies', JSON.stringify(Dependencies))
socket.on('change', handleChanges)