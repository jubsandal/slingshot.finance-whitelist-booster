import * as fs from 'fs'
import { db, Account } from './libs/Account.js'

let accs = []
for (let acc of db.accounts.documents) {
    acc.email.broken = false
    accs.push(acc)
}

fs.writeFileSync("asdf.json", JSON.stringify(accs, null, '\t'))
