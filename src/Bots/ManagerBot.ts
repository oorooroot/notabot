import { Map } from "../Utils/Map";
import { Log } from "../Utils/Log";
import { IBot } from "./IBot";
import { IMessage } from "./IMessage";
import * as schedule from 'node-schedule';
import * as events from 'events';

enum OutgoingMessageType {
    Message,
    Reply,
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

const MESSAGE_RESEND_PERIOD: number = 60 * 1000;

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
                message.reject("Message resend timeout!");
                continue;
            }

            Log.write(`Resending message: ${message.type} ${message.text} ${message.attachment}`);

            if(message.type == OutgoingMessageType.Message) this.resendMessage(message);
            else if(message.type == OutgoingMessageType.Reply) this.resendReply(message);
            else if(message.type == OutgoingMessageType.File) this.resendFile(message);
        }
    }

    addBot(bot: IBot) {
        if(bot.ID) this.botList[bot.ID] = bot;

        bot.on("online", (bot, botID) => {
            this.botList[botID] = bot;
        });
        bot.on("message", (message) => {
            this.emit("message", message);
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

    resendMessage(message: MessageQueueItem) {
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

    resendFile(message: MessageQueueItem) {
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

    resendReply(message: MessageQueueItem) {
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