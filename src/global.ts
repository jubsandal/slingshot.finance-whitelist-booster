import { MultiProgressBars  } from 'multi-progress-bars';
import { Account } from "./libs/Account.js"

export let mpb: MultiProgressBars = new MultiProgressBars({
    initMessage: ' $ Boosting slingshot waitlist ',
    anchor: 'top',
    persist: true,
    border: true,
});

export function accountBarID(account: Account) {
    return account.id+":"+account.email.login
}
