import { Account, db } from './libs/Account.js'

const done = (await db.accounts.findMany(a => a.referals!.length >= 20)).map(a=>new Account(a))
console.log("Done count:", done.length)
console.log("Broken mails:", (await db.accounts.findMany(a => a.email.broken ?? false )).length)
for (const account of done) {
    console.log("id:", account.id)
    console.log("e-mail:", account.email.login)
    console.log("passwd:", account.email.password)
    console.log("Access:", account.accessLink)
}
