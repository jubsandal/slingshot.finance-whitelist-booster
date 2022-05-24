import imap from 'imap'
import util from 'util'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import { ParsedMail, simpleParser } from 'mailparser'

import { sleep } from './utils.js'

export class EMail extends EventEmitter {
    private imap: imap

    constructor(login: string, password: string) {
        super()
        console.log("Entering email:", login)
        // TODO switch only server opts
        this.imap = new imap({
            user: login,
            password: password,
            host: 'imap.mail.ru',
            port: 993,
            tls: true
        })

        this.imap.once('error', function(err: any) {
            console.log("ERROR:", err);
        });

        this.imap.once('end', function() {
            console.log('Connection ended');
        });
    }

    deconstructor() {
        this.imap.closeBox(true, () => {})
        this.imap.destroy()
    }

    public init() {
        this.imap.connect()
        return new Promise(( res, rej ) => {
            this.imap.once("error", () => rej("notok"))
            this.imap.once("ready", () => res("ok"))
        })
        
    }

    openInbox(cb: any) {
        this.imap.openBox('INBOX', true, cb);
    }

    async lastEmails(): Promise<ParsedMail[]> {
        return await new Promise(( resolve ) => {
            this.openInbox(() => {
                var f = this.imap.seq.fetch('1:3', {
                    bodies: '',
                });
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
                                resolve(messages)
                            }
                        });
                    });
                    msg.once('end', () => {
                        // con
                    });
                });
                f.once('error', function(err: any) { console.log('Fetch error: ' + err); });
                f.once('end', () => { console.log('Done fetching all messages!'); this.imap.end(); });
            })
        })
    }
}
// let email = new EMail("mikhail.grishin.14.7.1988@mail.ru", "fkvBnh816cCtm0JXc3SC")
// email.init()
// email.once('ready', () => {
//     console.log("ready")
//     email.lastEmails()
// })

// email.once('readed', (messages: ParsedMail[]) => {
//     for (let m of messages) {
//         console.log(m.from)
//     }
// })
