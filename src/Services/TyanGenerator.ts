import { DatabaseTable, DatabaseDefinition } from "../Utils/DatabaseTable";
import { Database, KeyValueArg, QueryResult, NoRowsAffectedDatabaseException } from "../Utils/Database";
import { Map } from "../Utils/Map";
import { ManagerBot } from "../Bots/ManagerBot";
import { IMessage } from "../Bots/IMessage";

export class ITyanGeneratorData {
    value:string;
}

const TABLE_NAME: string = "tyan_generator";

@DatabaseDefinition({
    value: { type: "TEXT" }
})
export class TyanGenerator extends DatabaseTable {
    private commands: Map<{role:string, f:(source:IMessage, args:string[]) => any}> = {
        request: { role: 'user', f: this.processRequest.bind(this) },
    };

    constructor(protected db: Database, protected manager: ManagerBot) {
        super(db, TABLE_NAME);

        manager.on('реквест', (source:IMessage, params:string[]) => {
            this.proccessCommand('request', source, params);
        });
        manager.on('request', (source:IMessage, params:string[]) => {
            this.proccessCommand('request', source, params);
        });
    }


    private proccessCommand(command:string, source:IMessage, params:string[]) {
        var commandSettnigs = this.commands[command];
        this.manager.checkMessagePermissions(source, commandSettnigs.role)
        .then(havePermission => { if(havePermission) commandSettnigs.f(source, params) });
    }

    processRequest(source:IMessage, args:string[]) {
        this.get()
        .then(name =>{
            this.manager.replyMessage(source, name + "-тян");
        })
    }

    get():Promise<string> {
        return this.db.select(TABLE_NAME, null, null, ["RANDOM()"], 1)
        .then(
            result => {
                if(result && result.length > 0) {
                    return result[0].value;
                }
                else {
                    throw "No result!"
                }
            }
        );
    }
}