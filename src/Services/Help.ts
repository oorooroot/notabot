import { Map } from "../Utils/Map";
import { Service } from './Service';
import { IMessage } from "../Bots/IMessage";
import { ManagerBot } from "../Bots/ManagerBot";
import { Exception } from "../Utils/Exception";
import * as schedule from 'node-schedule';

export abstract class HelpService extends Service {

    protected commands: Map<{ role: string, f: (source: IMessage, args: string[]) => any }> = {
        subscribe: { role: 'admin', f: this.processSubscribeMessage.bind(this) },
        unsubscribe: { role: 'admin', f: this.processUnsubscribeMessage.bind(this) },
        refresh: { role: 'admin', f: this.processRefreshSubscriptions.bind(this) },
        list: { role: 'admin', f: this.processListSubscriptions.bind(this) }
    };

    constructor(manager: ManagerBot, debug?:boolean) {
        super();

        manager.on('help', (source: IMessage, params: string[]) => {
            if (!params[0] || !this.urlBelongsToService(params[0])) return;
            this.proccessCommand('subscribe', source, params);
        });

        manager.on('unsubscribe', (source: IMessage, params: string[]) => {
            if (!params[0] || !this.urlBelongsToService(params[0])) return;
            this.proccessCommand('unsubscribe', source, params);
        });

        manager.on('list', (source, args) => {
            this.proccessCommand('list', source, args);
        });

        manager.on('refresh', (source, args) => {
            this.proccessCommand('refresh', source, args);
        });

    }