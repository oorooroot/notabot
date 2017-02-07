import { IMessage } from "./IMessage";
import * as pegjs from 'pegjs';

export interface IBot {
    ID:string;
    CommandParser: pegjs.Parser;

    connect();
    sendMessage(channelID: string, text: string, options?: any): Promise<any>;
    replyMessage(sourceMessage:IMessage, text: string, options?: any): Promise<any>;
    sendFile(channelID: string, attachment: string, text?:string): Promise<any>;
    checkMessagePermissions(message:IMessage, permission: string): Promise<boolean>;

    on(event: 'online', listener: (bot:IBot, botID:string) => void): this;
    on(event: 'offline', listener: (bot:IBot, botID:string) => void): this;
    on(event: 'message', listener: (message:IMessage) => void): this;
    on(event: string, listener: Function): this;
}