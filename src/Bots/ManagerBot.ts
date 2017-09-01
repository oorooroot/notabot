import { Map } from "../Utils/Map";
import { Log } from "../Utils/Log";
import { Exception } from "../Utils/Exception";
import { IBot } from "./IBot";
import { IMessage } from "./IMessage";
import * as schedule from 'node-schedule';
import * as events from 'events';
import * as process from 'process';

export class MessageSendException extends Exception {
    constructor(message?: string) {
        super(message);
        this.name = 'MessageSendException';
    }    
} 

export class BotManagerException extends Exception {
    constructor(message?: string) {
        super(message);
        this.name = 'BotManagerException';
    }    
} 

enum OutgoingMessageType {
    Message,
    Reply,
    ReplyDM,
    File
}

interface MessageQueueItem {
    date: Date;
    type: OutgoingMessageType;
    botID: string;
    channelID: string;
    text?: string;
    attachment?: string;
    origin?: IMessage;
    options?: any;
    resolve?: any;
    reject?: any;
}

interface ResendOptions {
    date?: Date;
}

var MESSAGE_RESEND_PERIOD: number =  60 * 1000; 
if(process.env.NODE_ENV === 'testing') { MESSAGE_RESEND_PERIOD =  2 * 1000; }

export class ManagerBot extends events.EventEmitter {
    private botList: Map<IBot> = new Map<IBot>();
    private messageQueue: MessageQueueItem[] = [];

    constructor() {
        super();

        schedule.scheduleJob('* * * * * *', () => {
            this.processMessageQueue();
        });
    }

    private processMessageQueue() {
        while(this.messageQueue.length > 0) {
            var message = this.messageQueue.shift();
            var delay = Math.abs((new Date()).getTime() - message.date.getTime());


            if(delay > MESSAGE_RESEND_PERIOD) {
                message.reject(new MessageSendException("Message resend timeout!"));
                continue;
            }

            Log.write(`Resending message: ${message.type} ${message.text} ${message.attachment}`);

            if(message.type == OutgoingMessageType.Message) process.nextTick(() => { this.resendMessage(message) });
            else if(message.type == OutgoingMessageType.Reply) process.nextTick(() => { this.resendReply(message) });
            else if(message.type == OutgoingMessageType.File) process.nextTick(() => { this.resendFile(message) });
        }
    }

    addBot(bot: IBot) {
        if(bot.ID) this.botList[bot.ID] = bot;

        bot.on("error", (err) => {
            Log.write(err);
        });
        bot.on("online", (bot, botID) => {
            this.botList[botID] = bot;
        });
        bot.on("command", (command:string, message:IMessage, parameters: string[]) => {
            this.emit(command, message, parameters);
        });
    }

    getBotByID(botID: string) : IBot {
        return this.botList[botID];
    }

    sendMessage(botID: string, channelID: string, text: string, options?: any): Promise<void> {
        var bot = this.botList[botID];

        return new Promise<void>((resolve, reject) => {
            if(bot) { 
                bot.sendMessage(channelID, text, options)
                .then(() => { resolve(); })
                .catch(error => {
                    this.messageQueue.push(
                        {
                            date: new Date(),
                            type: OutgoingMessageType.Message,
                            botID: botID,
                            channelID: channelID,
                            text: text,
                            options: options,
                            resolve: resolve,
                            reject: reject
                        }
                    );
                });  
            }
            else {
                this.messageQueue.push(
                    {
                        date: new Date(),
                        type: OutgoingMessageType.Message,
                        botID: botID,
                        channelID: channelID,
                        text: text,
                        options: options,
                        resolve: resolve,
                        reject: reject
                    }
                );
            }
        });
    }

    private resendMessage(message: MessageQueueItem) {
         var bot = this.botList[message.botID];
         if(!bot) this.messageQueue.push(message);
         else {
             bot.sendMessage(message.channelID, message.text, message.options)
             .then(() => { message.resolve(); })
             .catch(
                 error => {
                     this.messageQueue.push(message);
                 }
             );
         }
    }

    replyDirectMessage(sourceMessage: IMessage, text: string, options?: any): Promise<void> {
        var bot = this.botList[sourceMessage.BotID];

        return new Promise<void>((resolve, reject) => {
            if(bot) { 
                bot.replyDirectMessage(sourceMessage, text, options)
                .then(() => { resolve(); })
                .catch(error => {
                   this.messageQueue.push(
                        {
                            date: new Date(),
                            type: OutgoingMessageType.ReplyDM,
                            botID: sourceMessage.BotID,
                            channelID: sourceMessage.ChannelID,
                            origin: sourceMessage,
                            text: text,
                            resolve: resolve,
                            reject: reject
                        }
                   );
                });  
            }
            else {
                this.messageQueue.push(
                    {
                        date: new Date(),
                        type: OutgoingMessageType.ReplyDM,
                        botID: sourceMessage.BotID,
                        channelID: sourceMessage.ChannelID,
                        origin: sourceMessage,
                        text: text,
                        resolve: resolve,
                        reject: reject
                    }
                );
            }
        });
    }

    sendFile(botID: string, channelID: string, attachment: string, text?:string): Promise<void> {
        var bot = this.botList[botID];

        return new Promise<void>((resolve, reject) => {
            if(bot) { 
                bot.sendFile(channelID, attachment, text)
                .then(() => { resolve(); })
                .catch(error => {
                    this.messageQueue.push(
                        {
                            date: new Date(),
                            type: OutgoingMessageType.File,
                            botID: botID,
                            channelID: channelID,
                            attachment: attachment,
                            text: text,
                            resolve: resolve,
                            reject: reject
                        }
                    );
                });  
            }
            else {
                this.messageQueue.push(
                    {
                        date: new Date(),
                        type: OutgoingMessageType.File,
                        botID: botID,
                        channelID: channelID,
                        attachment: attachment,
                        text: text,
                        resolve: resolve,
                        reject: reject
                    }
                );
            }
        });
    }

    private resendFile(message: MessageQueueItem) {
         var bot = this.botList[message.botID];
         if(!bot) this.messageQueue.push(message);
         else {
             bot.sendFile(message.channelID, message.attachment, message.text)
             .then(() => { message.resolve(); })
             .catch(
                 error => {
                     this.messageQueue.push(message);
                 }
             );
         }
    }

    replyMessage(sourceMessage: IMessage, text: string, options?: any): Promise<void> {
        var bot = this.botList[sourceMessage.BotID];

        return new Promise<void>((resolve, reject) => {
            if(bot) { 
                bot.replyMessage(sourceMessage, text, options)
                .then(() => { resolve(); })
                .catch(error => {
                    this.messageQueue.push(
                        {
                            date: new Date(),
                            type: OutgoingMessageType.Reply,
                            botID: sourceMessage.BotID,
                            channelID: sourceMessage.ChannelID,
                            origin: sourceMessage,
                            text: text,
                            resolve: resolve,
                            reject: reject
                        }
                    );
                });  
            }
            else {
                this.messageQueue.push(
                    {
                        date: new Date(),
                        type: OutgoingMessageType.Reply,
                        botID: sourceMessage.BotID,
                        channelID: sourceMessage.ChannelID,
                        origin: sourceMessage,
                        text: text,
                        resolve: resolve,
                        reject: reject
                    }
                );
            }
        });
    }

    private resendReply(message: MessageQueueItem) {
         var bot = this.botList[message.botID];
         if(!bot) this.messageQueue.push(message);
         else {
             bot.replyMessage(message.origin, message.text, message.options)
             .then(() => { message.resolve(); })
             .catch(
                 error => {
                     this.messageQueue.push(message);
                 }
             );
         }
    }

    checkMessagePermissions(sourceMessage: IMessage, permission: string): Promise<boolean> {
        if(!sourceMessage) return Promise.reject(new BotManagerException('Message is not defined!'));

        var bot = this.botList[sourceMessage.BotID];

        return new Promise<boolean>((resolve, reject) => {
            if(bot) {
                bot.checkMessagePermissions(sourceMessage, permission)
                .then(result => {
                    resolve(result);
                })
                .catch(error => {
                    resolve(false);
                });
            }
            else return resolve(false);
        });
    }
}