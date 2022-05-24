import imap from 'imap'
import util from 'util'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import * as cheerio from 'cheerio'
import { ParsedMail, simpleParser } from 'mailparser'
import { EMail } from './Account.js'
import { sleep } from './utils.js'

async function connect(email: EMail): Promise<imap | null> {
    let conn = new imap({
        user: email.login,
        password: email.password,
        host: 'imap.mail.ru',
        port: 993,
        tls: true
    })
    conn.once('end', function() {
        console.log('Connection ended');
    });

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

export async function getLastUnread(email: EMail): Promise<ParsedMail[]> {
    let conn = await connect(email)

    if (!conn) throw "Cannot connect"

    return await new Promise(( resolve, reject ) => {
        openInbox(<imap>conn, () => {
            conn!.search([ 'UNSEEN', ['SINCE', new Date().toDateString().slice(4)]  ], function(err, results) {
                if (err) reject(err)
                var f = conn!.fetch(results, { bodies: ''  });
                let messages = new Array<ParsedMail>()
                let parsedcount = 0
                f.on('message', (msg: any, seqno: any) => {
                    var prefix = '(#' + seqno + ') ';
                    msg.on('body', (stream: any) => {
                        simpleParser(stream, async (err: any, parsed) => {
                            if (err) console.error(err)
                            const {from, subject, textAsHtml, text} = parsed;
                            messages.push(parsed)
                            parsedcount++
                            if (parsedcount == 3) {
                                conn!.closeBox(true, () => {})
                                conn!.destroy()
                                resolve(messages)
                            }
                        });
                    });
                    msg.once('end', () => {
                        // con
                    });
                });
                f.once('error', function(err: any) { console.log('Fetch error: ' + err); });
                f.once('end', () => { console.log('Done fetching all messages!'); conn!.end(); });
            })
        })
    })
}

async function htmlSearchVerify(html: string) {
    let doc = cheerio.load(html)
    let link = doc('td>a')[0]
    if (typeof link === 'object' && link.data("text") == "VERIFY" && doc('td>a').data('href')?.includes("slingshot")) {

    }
}
