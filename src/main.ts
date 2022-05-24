import puppeteer from 'puppeteer'
import { Config } from './Config.js'
import { db, Account } from './libs/Account.js'
import { Worker } from './Worker.js'

await Account.importEmails('order_16812036.txt')

for (let account of db.accounts.documents) {
    if (account.referals!.length < 20) {
        let w = new Worker(new Account(account))
        await w.run()
    }
}
