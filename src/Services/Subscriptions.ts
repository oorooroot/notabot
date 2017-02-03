import { DatabaseTable, DatabaseDefinition } from "../Utils/DatabaseTable";
import { Database, KeyValueArg, QueryResult, NoRowsAffectedDatabaseException } from "../Utils/Database";

export class ISubscriptionsData {
    id?:number;
    url?:string;
    botId:string;
    botChannelId:string;
    serviceType:string;
    serviceId:string;
    serviceItemType:string;
    serviceTitle?:string;
    serviceLastUpdate?:Date;
}

const TABLE_NAME: string = "service_subscriptions";

@DatabaseDefinition({
    id: { type: "INTEGER", typeExtension: "PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE" },
    url: { type: "TEXT" },
    botId: { type: "VARCHAR" },
    botChannelId: { type: "VARCHAR" },
    serviceType: { type: "VARCHAR" },
    serviceId: { type: "VARCHAR" },
    serviceItemType: { type: "VARCHAR" },
    serviceTitle: { type: "TEXT" },
    serviceLastUpdate: { type: "DATETIME", typeExtension: "DEFAULT CURRENT_TIMESTAMP" }
})
export class Subscriptions extends DatabaseTable {
    constructor(protected db: Database) {
        super(db, TABLE_NAME);
    }

    get(where?:KeyValueArg<any>, fields?:string[], order?:string[], group?:string[]):Promise<ISubscriptionsData[]> {
        return this.db.select(TABLE_NAME, fields, where, order, null, group);
    }
    
    add(options:ISubscriptionsData):Promise<QueryResult> {
        var where = {
            botId: options.botId,
            botChannelId: options.botChannelId,
            serviceType: options.serviceType,
            serviceId: options.serviceId,
            serviceItemType: options.serviceItemType
        }

        return this.db.update(TABLE_NAME, options, where)
        .then<QueryResult>(
            result => {
                if(result.changes === 0 ) {
                    return this.db.insert(TABLE_NAME, options);
                }
                else return result;    
            }
        );
    }

    delete(options:ISubscriptionsData):Promise<QueryResult> {
        return this.db.delete(TABLE_NAME, options);
    }

    update(set:KeyValueArg<any>, where:any):Promise<QueryResult> {
        return this.db.update(TABLE_NAME, set, where);        
    }
}