const { readFileSync, existsSync } = require('fs')
const {parse, resolve,relative} = require('path')

module.exports = function fetchDependencies(file,root)
{
    
    function getDeps(mfile){
        let arr =[]
        
        const code = !existsSync(mfile)? '': readFileSync(mfile,{encoding: "utf-8"}).toString()
        
        if(parse(mfile).ext.match("css")){
        
            code.replace(/(?:url\()(?:"|')?[^'"\)]+/gi,m=>{
                arr.push(m.split(/\(|\)/)[1].replace(/'|"/g,''))
            })
    
        }
        if(parse(mfile).ext.match("htm")){
            
            code.replace(/(?:src|href)(?:=(?:"|'))(?!http|#)[^'"]+/gi,m=>{
                arr.push(m.split(/'|"/)[1])
            })
            let intStyle = Array.from(code.matchAll(/(?:\<style.*?>)(?<code>.*?)(?:\<\/style)/gsi))
            
            intStyle.forEach(({groups})=>{
                
                groups.code.replace(/(?:url\()(?:"|')?[^'"\)]+/gi,m=>{
                    arr.push(m.split(/\(|\)/)[1].replace(/'|"/g,''))
                })
            })
    
        }
        return arr
    }

    const resolveDep = (f,dep)=> resolve(parse(f).dir,dep)

    function fetchDeps(dfile){
        let deps = getDeps(dfile)
        
        return deps.map(dep=>({
            file: relative(root, resolveDep(dfile,dep)),
            deps: fetchDeps(resolveDep(dfile,dep))
        }))
    }
    
    return fetchDeps(file)

}