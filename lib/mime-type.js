const fs = require('fs')
const path = require('path')

module.exports = (file)=>{
    const mtype = JSON.parse(fs.readFileSync(__dirname+'/mime-type.json'))

    const ext = path.parse(file).ext.replace(/\.+/g,'')

    for(let type in mtype){
        reg = new RegExp(mtype[type].replace(/\,/g,'|'),'gi')
        if(reg.test(ext)) return type
    }

    return '*/*'
}