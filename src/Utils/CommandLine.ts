import * as util from 'util';
import * as events from 'events';
import { Log } from './Log';
import { Map } from './Map';
import { Exception } from './Exception';
import { IMessage } from '../Bots/IMessage';
import { IBot } from '../Bots/IBot';
import { ManagerBot } from '../Bots/ManagerBot';

export interface ICommandLine {

    parseMessage(bot: IBot, message: IMessage);
    on(command: string, listener: (source:IMessage, params:string[]) => any): this;
}

export class CommandLine extends events.EventEmitter implements ICommandLine {
    
    private commands: string = "";    
    constructor(protected manager: ManagerBot) {
        super();

        this.manager.on("message", this.parseMessage.bind(this));

        this.on("help", (source:IMessage, params:string[]) => {
            this.manager.replyMessage(source, "registered commands: " + this.commands + ". You can use %command_name% help for command details.");
        });
    }

    parseMessage(bot: IBot, message: IMessage) {
        try {
            var parsedMessage = bot.CommandParser.parse(message.Text);
        }
        catch(error) {
            Log.write("CommandLine parsing error:", message.Text, error);
            return;
        }

        parsedMessage.query.forEach((item, i, arr) => {
            this.emit(item.command, message, item.parameters)
        });
    }

    public registerCommand(name: string) {
        this.commands += this.commands == "" ? name : ', ' + name;
    }
}