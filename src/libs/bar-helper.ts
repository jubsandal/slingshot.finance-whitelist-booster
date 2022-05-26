import { mpb, accountBarID } from './../global.js'
import chalk from 'chalk';
import { Account } from './Account.js'

export function addParentTask(account: Account) {
    mpb.addTask(accountBarID(account), {
        type: 'percentage',
        index: 1,
        message: 5*account.referals.length + '/20',
        percentage: 5*account.referals.length/100,
        barTransformFn: (m) => chalk.yellow(m)
    })
}

export function updateParentTask(account: Account) {
    mpb.updateTask(accountBarID(account), {
        percentage: 5*account.referals.length/100,
        message: account.referals.length+"/20",
        barTransformFn:
            account.referals.length === 20 ?
                (m) => chalk.green(m)
                :
                (m) => chalk.yellow(m),
    })
}

export class WorkerBarHelper {
    private curTask = 0
    constructor(
        private account: Account,
        private tasks: Array<string>
    ) {

    }

    create() {
        mpb.addTask(accountBarID(this.account), {
            type: "percentage",
            message: this.tasks[this.curTask],
            barTransformFn: (m) => chalk.blueBright(m)
        })
    }

    next() {
        this.curTask++
        mpb.updateTask(accountBarID(this.account), {
            message: this.tasks[this.curTask],
            percentage: this.curTask/this.tasks.length
        })
    }
}

export function doneReferalTask(account: Account, success: boolean) {
    mpb.done(accountBarID(account), {
        barTransformFn: (m) => chalk[(success ? "green" : "red")](m),
        message: (success ? "Success" : "Failed")
    })
}
