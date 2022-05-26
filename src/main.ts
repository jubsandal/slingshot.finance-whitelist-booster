import puppeteer from 'puppeteer-extra'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import { Config } from './Config.js'
import { log } from './libs/utils.js'
import { db, Account } from './libs/Account.js'
import { Worker, SuccessCodes } from './Worker.js'
import { Worker as Test } from './WorkerTest.js'
import { MultiProgressBars  } from 'multi-progress-bars';
import chalk from 'chalk';
import * as fs from 'fs'
import { mpb, accountBarID } from './global.js'
import { addParentTask, updateParentTask, doneReferalTask } from './libs/bar-helper.js'

for (let file of fs.readdirSync("import")) {
    await Account.importEmails("import/" + file)
}

puppeteer.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: Config().captcha_token
        },
        visualFeedback: false
    })
)

const overall = db.accounts.documents.length

let curParentI = 0
let parentsID = (await db.accounts.findMany((a) => a.refLink != "" && a.referals!.length < 20)).map(a => <number>a.id)
let curParentID = -1
let curParent = async () => new Account(<Account>await db.accounts.findOne({id:curParentID}))
if (parentsID.length > 0) {
    curParentID = parentsID[curParentI]
    addParentTask(await curParent())
} else {
    process.exit()
}

log.echo("Parents:", parentsID.length)

let passed = ( overall - (await db.accounts.findMany((a) => 
    a.accessLink === "" &&
    a.referals!.length === 0
)).length )
let initialPassed = passed
let shift = false

mpb.addTask('Registred', {
    index: 0,
    type: 'percentage',
    percentage: passed / overall,
    message: passed + "/" + overall
})

let accounts = (await db.accounts.findMany((a) => 
    a.email.broken == false &&
    a.accessLink === "" &&
    a.referals!.length === 0
)).map(a => new Account(a))
for await (let account of accounts) {
    if (account.accessLink === "" && account.referals.length < 20) { // not registred
        log.echo("Passing", account.email.login)

        if (( shift === true || (passed - initialPassed) % 8 === 0 ) && (passed - initialPassed) != 0) {
            shift = true
            mpb.removeTask(2, true)
        }

        let res = await new Worker(account, (await curParent()).refLink).run() // register and verify
        account = res.account
        switch (res.success.code) {
            case SuccessCodes.ok:
                await account.setParent(await curParent())
               log.echo("Registred with access link:", account.accessLink)
                break;
            case SuccessCodes.email_error:
                await account.markEmailBroken()
                log.error("An email error")
                break;
            case SuccessCodes.unknown_error:
            default:
                log.error("An unknown error")
                break;
        }

        if (res.success.code != SuccessCodes.ok) {
            doneReferalTask(account, false)
        } else {
            doneReferalTask(account, true)
        }

        updateParentTask(await curParent())

        let newParent = false
        // if (curParent >= 0) { // if registred by ref link
        if ((await curParent()).referals.length >= 20) { // if have 20+ referals
            curParentI++
            curParentID = parentsID[curParentI]
            newParent = true
            if (parentsID.length <= curParentI) { // have next reserved parent, do next
                // parentList.push(account)
                log.echo("Parents left")
                break;
            }
        }
        // } else {
        //     console.log("Parents left")
        //     break;
        //     // if (account.refLink != "" && account.referals.length < 20) {
        //     //     newParent = true
        //     //     parentList.push(account)
        //     //     curParent = 0
        //     // }
        // }

        if (newParent) {
            addParentTask(await curParent())
        }

        passed++
        mpb.updateTask("Registred", {
            percentage: passed/overall,
            message: passed + "/" + overall
        })
    } else {
        // console.log("Skiping account:", account.email.login)
    }
}

await db.accounts.save()
mpb.done('Registred', { message: "Done" })
