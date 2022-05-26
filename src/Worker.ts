import puppeteer from 'puppeteer-extra'
import puppeteerDefault from 'puppeteer'
import chalk from 'chalk';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { EventEmitter } from 'events'
import { ParsedMail } from 'mailparser'

import { randSleep, sleep } from './libs/utils.js'
import { Account } from './libs/Account.js'
import { Config } from './Config.js'
import { selectors } from './libs/selectors.js'
import { enterEmail, getLastUnread, htmlSearchVerify } from './libs/email-helper.js'
import { mpb, accountBarID } from './global.js'
import { WorkerBarHelper } from './libs/bar-helper.js'

let launchOpts = () => {
    return {
        headless: Config().headless,
        // product: 'firefox',
        // executablePath: '/usr/bin/firefox',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    }
}

export enum SuccessCodes {
    ok,
    email_error,
    unknown_error
}

type WorkerResult = {
    success: {
        code: SuccessCodes
        // description?
    }
    account: Account
}

export class Worker extends EventEmitter {
    // @ts-ignore
    protected browser: puppeteer.Browser;
    protected account: Account;

    private barHelper: WorkerBarHelper

    constructor(account: Account, protected refLink: string) {
        super()
        this.account = account
        this.barHelper = new WorkerBarHelper(
            this.account,
            [
                "Initializing",
                "Joining white list",
                "Solving captcha",
                "Fetching email",
                "Proceeding by verification link"
            ]
        )
    }

    public async run(): Promise<WorkerResult> {
        let error = {
            code: SuccessCodes.ok
        }
        this.barHelper.create()
        try {
            await this.init()
            this.barHelper.next()
            await this.joinWhiteList()
            this.barHelper.next()
            let link = await this.scrapRefLink()
            if (link) {
                this.barHelper.next()
                await this.doVerify(link)
            } else {
                error.code = SuccessCodes.email_error
            }
        } catch (e) {
            console.log(e)
            error.code = SuccessCodes.unknown_error
        } finally {
            try {
                await this.browser.close()
            } catch(e) {}
            return {
                success: error,
                account: this.account
            }
        }
    }

    protected async doVerify(link: string) {
        // await enterEmail(this.browser, this.account.email)

        try {
            let page = (<puppeteerDefault.Page>await this.page())

            await page.goto(link, { waitUntil: "domcontentloaded" })
            await randSleep(2500, 2000)
            await page.goto(link, { waitUntil: "domcontentloaded" })
            let pageErrorPromise = new Promise((resolve) => {
                page.once("pageerror", () => resolve(true))
                page.once("error", () => resolve(true))
                sleep(5000).then(() => resolve(false))
            })
            let res = await pageErrorPromise
            if (res) {
                throw "sdf"
            } else {
                this.account.setAccessLink(page.url)
            }
            

            // await page.waitForSelector(selectors.slingshot.refLink)
            // let reflink = await (<puppeteerDefault.Page>page).$eval(selectors.slingshot.refLink, e=>e.textContent)

            // if (reflink) {
            //     await this.account.setRefLink(reflink)
            // }
        } catch (e) { }
    }

    protected async scrapRefLink() {
        let page = await this.page()
        let link = ""

        const maxTries = 2;
        const waitTime = 12 * 1000;
        for (let tries = 0; tries < maxTries; tries++) {
            try {
                let mails = await getLastUnread(this.account.email)
                for (let mail of mails) {
                    if (
                        mail.from &&
                        mail.from.value[0].address === "hello@slingshot.finance"
                    ) {
                        if (mail.html) {
                            let res = htmlSearchVerify(mail.html)
                            if (res) {
                                link = res
                                break
                            }
                        }
                    }
                }
                if (link != "") {
                    break;
                }
            } catch (e) { }
            await sleep(waitTime)
        }
        return link
    }

    protected async joinWhiteList() {
        let page = await this.page()

        console.log("Ref link:", this.refLink)
        await page.goto(this.refLink)

        await page.waitForSelector(selectors.slingshot.email_input, {
            timeout: 5000
        })

        await page.type(selectors.slingshot.email_input, this.account.email.login, {
            delay: 53
        })

        await randSleep(100, 10)

        await page.hover(selectors.slingshot.join_button)
        await randSleep(200, 100)
        await page.click(selectors.slingshot.join_button)

        try {
            await page.waitForSelector("#rc-anchor-container", { timeout: 5000 })
        } catch (e) {}
        this.barHelper.next()
        const {
            captchas,
            filtered,
            solutions,
            solved,
            error

        } = await (<puppeteerDefault.Page>page).solveRecaptchas()
        if (error) {
            throw "Cannot solve captcha"
        } else {
            console.log("Captcha solved")
        }
    }

    protected async page() { return (await this.browser.pages())[0] }

    protected async init() {
        try {
            // @ts-ignore
            this.browser = await puppeteer.launch(launchOpts())
            if (!this.browser) {
                throw "Cannot create browser"
            }
            let page = await this.page();

            if (Config().proxy.length) {
                await page.setRequestInterception(true)

                function randomProxy(): string {
                    let proxy = Config().proxy.at(0+Math.floor(Math.random() * Config().proxy.length) )
                    let proxyString = "http://" + proxy!.user + ":" + proxy!.password + "@" + proxy!.host
                    console.log("Using proxy:", proxyString)
                    return proxyString;
                }

                const proxyString = randomProxy()
                page.on('request', async (request: any) => {
                    await proxyRequest({
                        page: page,
                        proxyUrl: proxyString,
                        request,
                    });
                });
            }

            await page
                .setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')

            await page.setViewport({ width: 1920, height: 1060 })
            await page.setDefaultNavigationTimeout(500000);
            // await page.on('dialog', async (dialog: puppeteer.Dialog) => {
            //     await dialog.accept();
            // });
            await page.on('error', (err: any) => {
                const errorMessage = err.toString();
                console.log('browser error:', errorMessage)
            });
            await page.on('pageerror', (err: any) => {
                const errorMessage = err.toString();
                console.log("browser page error:", errorMessage)
            });
        } catch (err) {
            throw new Error('page initialization failed. Reason: ' + err);
        }
    }
}
