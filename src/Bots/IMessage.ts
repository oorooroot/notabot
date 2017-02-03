import { IBot } from "./IBot";

export interface IMessage {
    BotID: string;
    ChannelID: string;
    Text: string;
    NativeMessage: any;
}