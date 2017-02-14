import { IBot } from "./IBot";
import { IMessage } from "./IMessage";
import { Log } from "../Utils/Log";
import * as event from 'events';
import * as discord from 'discord.js';
import * as pegjs from 'pegjs';
import * as fs from 'fs';
import * as process from 'process';

let TelegramClient = require('node-telegram-bot-api');

const PERMISSIONS = {
    admin: ["administrator", "creator"],
    user: ["member", "administrator", "creator"]
};

enum OutgoingMessageType {
    Message,
    Reply,
    File
}

const GRAMMAR_PATH = __dirname + "/TelegramCommand.peg";

export class TelegramBot extends event.EventEmitter implements IBot {
    private token: string;
    private client: any;
    private uid: string;
    private commandParser: pegjs.Parser;

    get ID(): string {
        return this.uid;
    }

    constructor() {
        super();

        this.commandParser = pegjs.generate(fs.readFileSync(GRAMMAR_PATH).toString());

        if (!process.env.TELEGRAM_TOKEN) {
            Log.write(`Failed to load telegram credentials, not initialized!`);
            return;
        }
    }

    connect() {
        this.client = new TelegramClient(process.env.TELEGRAM_TOKEN, { polling: true });
        Log.write('Telegram bot connected to server successfully.');

        this.client.getMe()
            .then(botValue => {
                this.uid = botValue.id;
                this.emit('online', this, this.uid);
            });

        this.client.on('message', (message) => {
            process.nextTick(() => {
                this.parseMessage(new TelegramMessage(message, this));
            });
        });
    }

    private typeMessage(channelID: string, type: string, delay: number): Promise<void> {
        return this.client.sendChatAction(channelID, type)
            .then(() => {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve();
                    }, delay)
                });
            });
    }

    sendMessage(channelID: string, text: string, options?: any): Promise<any> {
        return this.typeMessage(channelID, 'typing', 1500)
            .then(() => {
                this.client.sendMessage(channelID, text, options);
            });
    }

    replyMessage(sourceMessage: IMessage, text: string, options?: any): Promise<any> {
        if (!options) var options: any = {};
        options.reply_to_message_id = sourceMessage.NativeMessage.message_id;

        return this.typeMessage(sourceMessage.ChannelID, 'typing', 1500)
            .then(() => {
                this.client.sendMessage(sourceMessage.ChannelID, text, options);
            });
    }

    sendFile(channelID: string, attachment: string, text?: string): Promise<any> {
        return this.typeMessage(channelID, 'typing', 1500)
            .then(() => {
                return this.client.sendMessage(channelID, attachment, text);
            });
    }

    checkMessagePermissions(message: IMessage, permission: string): Promise<boolean> {
        return this.client.getChatMember(message.ChannelID, message.NativeMessage.from.id)
            .then(member => {
                return PERMISSIONS[permission].indexOf(member.status) > -1;
            });
    }

    private parseMessage(message: IMessage) {
        try {
            var parsedMessage = this.commandParser.parse(message.Text);
        }
        catch(error) {
            Log.write("CommandLine parsing error:", message.Text, error);
            return;
        }

        parsedMessage.query.forEach((item, i, arr) => {
            this.emit("command", item.command, message, item.parameters)
        });
    }
}

export class TelegramMessage implements IMessage {
    private nativeMessage: any;
    private id: any;

    get BotID(): string {
        return this.id;
    }
    get ChannelID(): string {
        return this.nativeMessage.chat.id.toString();
    }
    get Text(): string {
        return this.nativeMessage.text;
    }
    get NativeMessage(): any {
        return this.nativeMessage;
    }

    constructor(message: any, bot: IBot) {
        this.nativeMessage = message;
        this.id = bot.ID;
    }
}