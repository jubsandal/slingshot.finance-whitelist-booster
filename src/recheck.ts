import { Account, db } from './libs/Account.js'
import puppeteer from 'puppeteer-extra'
import puppeteerDefault from 'puppeteer'
import { Config } from './Config.js'
// @ts-ignore
import { proxyRequest } from 'puppeteer-proxy'
import { sleep, log } from './libs/utils.js'

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

async function init() {
    try {
        let browser = await puppeteer.launch(launchOpts())
        let page = await browser.newPage();

        // if (Config().proxy.length) {
        //     await page.setRequestInterception(true)

        //     function randomProxy(): string {
        //         let proxy = Config().proxy.at(0+Math.floor(Math.random() * Config().proxy.length) )
        //         let proxyString = "http://" + (proxy!.user && proxy!.password ? proxy!.user + ":" + proxy!.password + "@" : "") + proxy!.host
        //         log.echo("Using proxy:", proxyString)
        //         return proxyString;
        //     }

        //     const proxyString = randomProxy()
        //     page.on('request', async (request: any) => {
        //         await proxyRequest({
        //             page: page,
        //             proxyUrl: proxyString,
        //             request,
        //         });
        //     });
        // }

        await page
            .setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')

        await page.setViewport({ width: 1920, height: 1060 })
        await page.setDefaultNavigationTimeout(500000);
        await page.on('dialog', async (dialog: puppeteerDefault.Dialog) => {
            await dialog.accept();
        });
        await page.on('error', (err: any) => {
            const errorMessage = err.toString();
            log.error('browser error:', errorMessage)
        });
        await page.on('pageerror', (err: any) => {
            const errorMessage = err.toString();
            log.error("page error:", errorMessage)
        });
        return {
            browser: browser,
            page: page
        }
    } catch (err) {
        throw 'Page initialization failed. Reason: ' + err
    }
}

let parents = (await db.accounts.findMany((a) =>
    a.id == Number(process.argv[2])
    // a.id != 2 &&
    // a.referals!.length == 20
)).map(a => new Account(a))

console.log(parents)

let accounts = new Array<Account>()
for (let parent of parents) {
    for (let id of parent.referals) {
        // @ts-ignore
        accounts.push(new Account(await db.accounts.findOne({ id: id })))
    }
}

for (let account of accounts) {
    let { browser, page } = await init()
    if (account.verifyLink) {
        await page.goto(account.verifyLink)
    } else {
        await page.goto(account.accessLink)
    }
    await sleep(5000)
    await browser.close()
}
