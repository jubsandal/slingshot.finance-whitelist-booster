import * as fs from 'fs'
import chalk from 'chalk'

export function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function randSleep(max: number = 5000, min: number = 100) {
    let ms = Math.round(Math.random() * (max-min) + min)
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logTime() {
    return '[' + new Date().toLocaleTimeString() + ']'
}

if (!fs.existsSync("./.log/")) {
    fs.mkdirSync("./.log")
}
const logFileName = "./.log/log_" + new Date().toLocaleDateString().replaceAll('/', '.') + "_" + new Date().toLocaleTimeString("ru")

type ExtendedLog = {
    (...arg: any[]): void,
    echo:  (...arg: any[]) => void
    error: (...arg: any[]) => void
}
export let log = <ExtendedLog>function(...arg: any[]): void {
    fs.appendFileSync(logFileName, logTime() + ' - ' + arg.join(" ") + "\n")
}

log.error = function(...arg: any[]) {
    log("ERROR:", ...arg)
    
    // progress remove \r
    console.error(logTime(), '-', chalk.red(...arg))
}

log.echo = function(...arg: any[]) {
    log(...arg)
    console.log(logTime(), '-', ...arg)
}

