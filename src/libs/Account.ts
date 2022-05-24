import * as fs from 'fs'
import * as crypt from 'crypto'
import { number, array, assert, object, string } from 'superstruct'
import { Types, Database } from 'aloedb-node'

type EMail = {
    login: string,
    password: string
}

const EMailSign = object({
    login: string(),
    password: string()
})

interface IAccount {
    id?: number,
    email: EMail,
    refLink?: string,
    parent?: number,
    referals?: number[]
}

const AccountSign = object({
    id: number(),
    email: EMailSign,
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
    refLink: string;
    parent: number;
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

    async setRefLink(link: string) { this.refLink = link; return await this.sync() }
    async setParent(parent: number | IAccount) {
        if (typeof parent == "number") {
            this.parent = parent
        } else if (typeof parent == "object") {
            this.parent = <number>parent.id
        }

        // danger
        let pAccount = new Account(<IAccount>await accounts_db.findOne({ id: this.parent }))
        pAccount.referals.push(this.id)
        await pAccount.sync()

        await this.sync()
    }

    static async importEmails(file: fs.PathLike) {
        console.log("importing from", file)
        const raw = fs.readFileSync(file).toString()
        const lines = raw.split("\r\n")

        for (const line of lines) {
            const split = line.split(':')
            if (split[0].length > 2) {
                let acc = new Account({email: { login: split[0], password: split[1] }})
                if (await accounts_db.findOne({ email: acc.email })) {
                } else {
                    await acc.sync()
                }
            }
        }
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
