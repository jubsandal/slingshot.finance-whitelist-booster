import puppeteerDefault from 'puppeteer'
import imap from 'imap'
import util from 'util'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import * as cheerio from 'cheerio'
import { ParsedMail, simpleParser } from 'mailparser'
import { EMail } from './Account.js'
import { sleep } from './utils.js'
import {selectors} from './selectors.js'

async function connect(email: EMail): Promise<imap | null> {
    let conn = new imap({
        user: email.login,
        password: email.password,
        host: 'imap.mail.ru',
        port: 993,
        tls: true
    })
    conn.once('end', function() { });

    return new Promise(( res, rej ) => {
        conn.once("error", () => rej(null))
        conn.once("ready", () => {
            conn.removeAllListeners("error")
            conn.once('error', function(err: any) { console.log("IMAP Error:", err); });
            res(conn)
        })
        conn.connect()
    })
}

function openInbox(conn: imap, cb: any): void {
    conn.openBox('INBOX', true, cb);
}

function parseBody(stream: any): Promise<ParsedMail> {
    return new Promise((resolve, reject) =>
        simpleParser(stream, async (err: any, parsed) => {
            if (err) reject(err)
            const {from, subject, textAsHtml, text} = parsed;
            resolve(parsed)
        })
    )
}

export async function enterEmail(browser: puppeteerDefault.Browser, email: EMail) {
    let page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.goto("https://mail.ru/", { waitUntil: "domcontentloaded" })

    await sleep(4000)

    await page.waitForSelector(selectors.mailru.login_button)
    await page.click(selectors.mailru.login_button)
    await sleep(3500)
    // await page.waitForSelector(selectors.mailru.login_input)
    await page.type(selectors.mailru.login_input, email.login, { delay: 100 })
    await sleep(2000)
    await page.click(selectors.mailru.entr_password_button)
    await sleep(2500)
    // await page.waitForSelector(selectors.mailru.password_input)
    await page.type(selectors.mailru.password_input, email.password, { delay: 200 })
    await sleep(2000)
    await page.click(selectors.mailru.sing_in_button)
}

export async function getLastUnread(email: EMail): Promise<ParsedMail[]> {
    let conn = await connect(email)

    if (!conn) throw "Cannot connect"

    return await new Promise(( resolve, reject ) => {
        openInbox(<imap>conn, async () => {
            conn!.search([ 'UNSEEN', ['SINCE', "May 24 2022"]  ], async (err, results) => {
                if (err) reject(err)
                if (results.length <= 0) reject("Nothing to fetch")
                let empty = false
                results.forEach((v) => { if (v === null || v === undefined) empty = true })
                if (empty) reject("Nothin to fetch")
                var f: imap.ImapFetch
                try {
                    f = conn!.fetch(results, { bodies: '' });
                    let parsed = new Array<ParsedMail>()
                    f.once('error', (err: any) => { reject(err) });
                    f.once('end', () => {
                        conn!.closeBox(true, () => {})
                        conn!.destroy()
                    });
                    f.on('message', (msg) => {
                        msg.on('body', (stream) => {
                            parseBody(stream)
                                .then(mail => {
                                    parsed.push(mail)
                                    if (parsed.length === results.length) {
                                        resolve(parsed)
                                    }
                                })
                                .catch(e => reject(e))
                        })
                        msg.once('end', () => { })
                    })
                } catch(e) {
                    reject(e)
                }
            })
        })
    })
}

export function htmlSearchVerify(html: string): string | null {
    let $ = cheerio.load(html)
    let res = null
    // @ts-ignore
    $('a').each((i, el) => {
        i
        if (
            // @ts-ignore
            el?.children[0].data == "VERIFY" &&
            // @ts-ignore
            el?.attribs?.href.includes("slingshot.finance")
        ) {
            // @ts-ignore
            res = el?.attribs?.href
        }
    })
    return res
}
