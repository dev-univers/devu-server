const { readFileSync, existsSync, statSync } = require('fs')
const { parse, resolve, relative } = require('path')

module.exports = function fetchDependencies(file, root) {

    function getDeps(mfile) {
        let arr = []

        if (existsSync(mfile) && !statSync(mfile).isFile()) return arr

        const code = !existsSync(mfile) ? '' : readFileSync(mfile, { encoding: "utf-8" }).toString()
        let cssIncludePattern = /(?:@import.+?)(?:url\((['"]|)|['"])(?<depimport>.+?)(['"]|(['"]|)\))|(?:url\((['"]|)(?<depurl>.+?)(['"]|)\))/gi

        if (parse(mfile).ext.match("css")) {

            let matched = Array.from(code.matchAll(cssIncludePattern))
            matched.map(m => m.groups.depimport || m.groups.depurl).filter(d => d ? !d.match(/^data:.+?\/.+?[;,]/) : false).forEach(dep => arr.push(dep))


        }
        if (parse(mfile).ext.match("htm")) {

            code.replace(/(?:src|href)(?:=(?:"|'))(?!http|#)[^'"]+/gi, m => {
                arr.push(m.split(/'|"/)[1])
            })
            let intStyle = Array.from(code.matchAll(/(?:\<style.*?>)(?<code>.*?)(?:\<\/style)/gsi))

            intStyle.forEach(({ groups }) => {

                let matched = Array.from(groups.code.matchAll(cssIncludePattern))
                matched.map(m => m.groups.depimport || m.groups.depurl).filter(d => d ? !d.match(/^data:.+?\/.+?[;,]/) : false).forEach(dep => arr.push(dep))

            })

        }
        return arr
    }

    const resolveDep = (f, dep) => resolve(parse(f).dir, dep)

    function fetchDeps(dfile) {
        let deps = getDeps(dfile)

        return deps.map(dep => ({
            file: relative(root, resolveDep(dfile, dep)),
            deps: fetchDeps(resolveDep(dfile, dep))
        }))
    }

    return fetchDeps(file)

}