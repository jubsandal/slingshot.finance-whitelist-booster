import * as fs from 'fs'
import * as crypt from 'crypto'
import { optional, boolean, number, array, assert, object, string } from 'superstruct'
import { Types, Database } from 'aloedb-node'

export type EMail = {
    login: string,
    password: string,
    broken?: boolean
}

const EMailSign = object({
    login: string(),
    password: string(),
    broken: optional(boolean())
})

interface IAccount {
    id?: number,
    email: EMail,
    accessLink?: string,
    verifyLink?: string,
    refLink?: string,
    parent?: number,
    referals?: number[]
}

const AccountSign = object({
    id: number(),
    email: EMailSign,
    accessLink: string(),
    verifyLink: optional(string()),
    refLink: string(),
    parent: number(),
    referals: array(number())
})

const AccountValidator = (document: any) => assert(document, AccountSign)
let accounts_db = new Database<IAccount>({
    path: "./accounts.json",
    pretty: true,
    autoload: true,
    immutable: true,
    onlyInMemory: false,
    schemaValidator: AccountValidator
})

export const db = { accounts: accounts_db }

export class Account implements IAccount {
    readonly id: number;
    readonly email: EMail;
    accessLink: string;
    refLink: string;
    parent: number;
    verifyLink?: string;
    referals: number[];

    constructor(acc: IAccount) {
        if (acc.id) {
            this.id = acc.id
        } else {
            if (accounts_db.documents.length == 0) {
                this.id = 0
            } else {
                this.id = Math.max(...accounts_db.documents.map(a => <number>a.id))+1
            }
        }
        if (this.id == null) {
            this.id = 0
        }
        this.accessLink = acc.accessLink ?? ""
        acc.email.broken = acc.email.broken ?? false
        this.verifyLink = acc.verifyLink ?? undefined
        this.email = acc.email
        this.refLink = acc.refLink ?? ""
        this.parent = acc.parent ?? -1
        this.referals = acc.referals ?? new Array()
    }

    async sync() {
        if (await accounts_db.findOne({ id: this.id })) {
            return await accounts_db.updateOne({ id: this.id }, this);
        } else {
            return await accounts_db.insertOne(this);
        }
    }

    async parentAccount() {
        let ia = await accounts_db.findOne({ id: this.parent })
        if (ia) {
            return new Account(ia)
        } else {
            return null
        }
    }

    async setAccessLink(link: string) { this.accessLink = link; return await this.sync() }
    async setVerificationLink(link: string) { this.verifyLink = link; return await this.sync() }
    async setRefLink(link: string) { this.refLink = link; return await this.sync() }
    async setParent(parent: number | Account | IAccount) {
        if (typeof parent === "number") {
            this.parent = parent
        } else if (typeof parent === "object") {
            this.parent = <number>parent.id
        }

        // danger
        let pAccount = new Account(<IAccount>await accounts_db.findOne({ id: this.parent }))
        pAccount.referals.push(this.id)
        await pAccount.sync()

        await this.sync()
    }
    async markEmailBroken(broken = true) {
        this.email.broken = broken
        return await this.sync()
    }

    static async importEmails(file: fs.PathLike) {
        console.log("importing from", file)
        const raw = fs.readFileSync(file).toString()
        const lines = raw.split("\r\n")

        let im = 0
        let skip = 0
        for (const line of lines) {
            const split = line.split(':')
            if (split[0].length > 2) {
                let acc = new Account({email: { login: split[0], password: split[1] }})
                if (await accounts_db.findOne((a) => a.email.login == acc.email.login && a.email.password == acc.email.password)) {
                    skip++
                } else {
                    im++
                    await acc.sync()
                }
            }
        }
        console.log("Imported", im, "Skiped", skip)
    }

    // static async findOne(query: Types.Query<IAccount> | Types.QueryFunction<IAccount> | undefined): Promise<Account | null> {
    //     const object = await accounts_db.findOne(query);
    //     if (object) return new Account(object);
    //     return null;
    // }

    // static async findMany(query: Partial<IAccount>): Promise<Account[]> {
    //     const objects = await accounts_db.findMany(query);

    //     return objects.map((obj) => {
    //         return new Account(obj);
    //     });
    // }
}
