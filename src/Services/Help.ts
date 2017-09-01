import { Map } from "../Utils/Map";
import { Service } from './Service';
import { IMessage } from "../Bots/IMessage";
import { ManagerBot } from "../Bots/ManagerBot";
import { Exception } from "../Utils/Exception";
import * as schedule from 'node-schedule';

export class Help extends Service {
    protected serviceType = 'help';

    protected commands: Map<{ role: string, f: (source: IMessage, args: string[]) => any }> = {
        help: { role: 'user', f: this.processHelpMessage.bind(this) }
    };

    constructor(protected manager: ManagerBot, debug?:boolean) {
        super();

        manager.on('help', (source: IMessage, params: string[]) => {
            this.proccessCommand('help', source, params);
        });

        this.initializeService();
    }

    protected processHelpMessage(source: IMessage, params: string[]) {
        this.manager.replyDirectMessage(source, "help");
    }

}