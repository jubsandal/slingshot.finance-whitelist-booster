import { Account } from './libs/Account.js'
import { randSleep, sleep } from './libs/utils.js'

export class Worker {
    protected account: Account;

    constructor(account: Account) {
        this.account = account
    }

    async run() {
        await randSleep(1000)
        return {
            success: true,
            account: this.account
        }
    }
}
