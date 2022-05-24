import puppeteer from 'puppeteer'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { EventEmitter } from 'events'
import { ParsedMail } from 'mailparser'

import { randSleep, sleep } from './libs/utils.js'
import { Account } from './libs/Account.js'
import { Config } from './Config.js'
import { selectors } from './libs/selectors.js'
import { EMail } from './libs/EMail.js'

let launchOpts = () => {
    return {
        headless: Config().headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    }
}

export class Worker extends EventEmitter {
    // @ts-ignore
    protected browser: puppeteer.Browser;
    protected account: Account;

    constructor(account: Account) {
        super()
        this.account = account
    }

    public async run() {
        try {
            await this.init()
            // await this.joinWhiteList()
            await this.confirmEmail()
            // await this.scrapRefLink()
        } catch (e) {
            console.log(e)
        } finally {
            await this.browser.close()
        }
    }

    protected async scrapRefLink() {

    }

    protected async confirmEmail() {
        let page = await this.page()

        let email = new EMail(this.account.email.login, this.account.email.password)
        await email.init()
        let messages = await email.lastEmails()

        for (let m of messages) {
            console.log(m.from)
        }

        // let v_b = await page.$x("//a[contains(., 'VERIFY')]")
        // v_b[0].click()
    }

    protected async joinWhiteList() {
        let page = await this.page()

        let parent = await this.account.parentAccount()
        if (parent && parent.refLink.includes("https://slingshot.finance/mobile")) {
            page.goto(parent.refLink)
        } else {
            page.goto("https://slingshot.finance/mobile")
        }

        await page.waitForSelector(selectors.slingshot.email_input, {
            timeout: 5000
        })

        await page.type(selectors.slingshot.email_input, this.account.email.login, {
            delay: 323
        })

        await randSleep()

        await page.hover(selectors.slingshot.join_button)
        await randSleep(1000, 200)
        await page.click(selectors.slingshot.join_button)

        // pass Capcha
    }

    protected async page() { return (await this.browser.pages())[0] }

    protected async init() {
        try {
            this.browser = await puppeteer.launch(launchOpts())
            if (!this.browser) {
                throw "Cannot create browser"
            }
            let page = await this.page();

            if (Config().proxy.length) {
                await page.setRequestInterception(true)

                function randomProxy(): string {
                    let proxy = Config().proxy.at(0+Math.floor(Math.random() * Config().proxy.length) )
                    if (!proxy) {
                        return randomProxy()
                    }
                    return "http://" + proxy.user + ":" + proxy.password + "@" + proxy.host;
                }

                page.on('request', async (request) => {
                    await proxyRequest({
                        page: page,
                        proxyUrl: randomProxy(),
                        request,
                    });
                });
            }

            await page
                .setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')

            await page.setViewport({ width: 1920, height: 1060 })
            await page.setDefaultNavigationTimeout(500000);
            await page.on('dialog', async (dialog: puppeteer.Dialog) => {
                await dialog.accept();
            });
            await page.on('error', async (err) => {
                const errorMessage = err.toString();
                this.emit("msg", 'browser error:', errorMessage, "account:", this.account.id)
            });
            await page.on('pageerror', async (err: any) => {
                const errorMessage = err.toString();
                this.emit("msg", { text: 'browser page error: ' + errorMessage + " account: " + this.account.id, details: {} })
            });
        } catch (err) {
            throw new Error('page initialization failed. Reason: ' + err);
        }
    }
}
