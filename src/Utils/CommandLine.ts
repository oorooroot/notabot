import * as util from 'util';
import * as events from 'events';
import { Log } from './Log';
import { Map } from './Map';
import { Exception } from './Exception';
import { IMessage } from '../Bots/IMessage';
import { IBot } from '../Bots/IBot';
import { ManagerBot } from '../Bots/ManagerBot';

/**
 * Interface for command line parser.
 * @export
 * @interface ICommandLine 
 */
export interface ICommandLine {

    /**
     * Called when message needs to be parsed.
     * @param {IMessage} message Original message that need to be parsed.
     * 
     * @memberOf ICommandLine
     */
    parseMessage(bot: IBot, message: IMessage);


    /**
     * Subscription for the bot commands.
     * @param {string} command Command name that was passed to bot(equals to first word in message where bot mentioned).
     * @param {(source:IMessage, params:string[]) => any} listener Command listener function.
     * @returns {this}
     * 
     * @memberOf ICommandLine
     */
    on(command: string, listener: (source:IMessage, params:string[]) => any): this;
}

/**
 * Class used as parser for messages addressed to bot.
 * @export
 * @class CommandLine
 * @extends {events.EventEmitter}
 * @implements {ICommandLine}
 */
export class CommandLine extends events.EventEmitter implements ICommandLine {
    
    /**
     * Commands help info.
     * @private
     * @type {string}
     * @memberOf CommandLine
     */
    private commands: string = "";    

    /**
     * Creates an instance of CommandLine.
     * 
     * @param {ManagerBot} manager Messaging manager for message sending.
     * 
     * @memberOf CommandLine
     */
    constructor(protected manager: ManagerBot) {
        super();

        this.manager.on("message", this.parseMessage.bind(this));

        this.on("help", (source:IMessage, params:string[]) => {
            this.manager.replyMessage(source, "registered commands: " + this.commands + ". You can use %command_name% help for command details.");
        });
    }

    /**
     * Called when message needs to be parsed.
     * @param {IMessage} message Original message that need to be parsed.
     * 
     * @memberOf CommandLine
     */
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

    /**
     * Used to register command at bot help index.
     * 
     * @param {string} name Command name to register.
     * 
     * @memberOf CommandLine
     */
    public registerCommand(name: string) {
        this.commands += this.commands == "" ? name : ', ' + name;
    }
}