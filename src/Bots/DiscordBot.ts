import { IBot } from "./IBot";
import { IMessage } from "./IMessage";
import { Log } from "../Utils/Log";
import * as event from 'events';
import * as discord from 'discord.js';
import * as pegjs from 'pegjs';
import * as fs from 'fs';

const PERMISSIONS = {
        admin: "ADMINISTRATOR",
        user: "SEND_MESSAGES"
    };

enum OutgoingMessageType {
    Message,
    Reply,
    File
}

const GRAMMAR_PATH = __dirname + "/DiscordCommand.peg";

export class DiscordBot extends event.EventEmitter implements IBot {
    private token: string;
    private client: discord.Client; 
    private uid: string;
    private commandParser: pegjs.Parser;

    get ID():string {
        return this.uid;
    }

    constructor(client: discord.Client) {
        super();

        this.commandParser = pegjs.generate(fs.readFileSync(GRAMMAR_PATH).toString());
        
        this.client = client;
        if(!process.env.DISCORD_TOKEN) {
            Log.write(`Failed to load discord credentials, not initialized!`);
            return;
        }
        
        this.token = process.env.DISCORD_TOKEN;

        this.client.on('error', (err) => {
		    this.emit('error', err);
        });
        this.client.on('ready', () => {
            Log.write('Discord bot connected to server successfully.');
            
            this.uid = this.client.user.id; 
		    this.emit('online', this, this.client.user.id);
        });
        this.client.on('disconnect', (closeEvent: CloseEvent) => {
            Log.write(`Discord bot was disconnected from server. Code ${closeEvent.code}. Reconnecting...`);
            
		    this.emit('offline', this, this.uid);
        });
        this.client.on('message', (message) => {
            if((message.author != this.client.user && message.channel instanceof discord.DMChannel) || (message.author != this.client.user && message.isMentioned(this.client.user)))
            {
                this.parseMessage(new DiscordMessage(message));
            }
        });
    }

    public connect() {
        this.client.login(this.token);
    }
    
    private typeMessage(channelID: string, delay: number): Promise<void> {
        var channel:any = this.client.channels.get(channelID);
        channel.startTyping();
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, delay)
        })
        .then(() => {
            return channel.stopTyping();
        });
    }

    sendMessage(channelID: string, text: string, options?: any): Promise<any> {
        var channel:any = this.client.channels.get(channelID);
        return this.typeMessage(channelID, 1500)
        .then(() => { return channel.send(text, options); });
    }

    replyDirectMessage(sourceMessage:IMessage, text: string, options?: any): Promise<any> {
        var user = this.client.users.get(sourceMessage.AuthorID);
        var channel: discord.DMChannel;
        return user.createDM()
        .then(dmchannel => {
            channel = dmchannel;
            return this.typeMessage(channel.id, 1500);
        })
        .then(() => { 
            return channel.send(text, options); 
        });
    }

    replyMessage(sourceMessage:IMessage, text: string, options?: any) : Promise<any> {
        return this.typeMessage(sourceMessage.ChannelID, 1500)
        .then(() => { return (sourceMessage.NativeMessage as discord.Message).reply(text, options); });
    }

    sendFile(channelID: string, attachment: string, text?:string) : Promise<discord.Message | discord.Message[]> {
        var channel:any = this.client.channels.get(channelID);
        return this.typeMessage(channelID, 1500)
        .then(() => { 
            return channel.send(text, { files: [attachment] }); 
        });
    }

    checkMessagePermissions(message:IMessage, permission: string): Promise<boolean> {
        var discordMsg = message.NativeMessage as discord.Message;
        if(discordMsg.channel instanceof discord.DMChannel || discordMsg.channel instanceof discord.GroupDMChannel) {
            return Promise.resolve(true);
        }
        
        var userPermissions = (discordMsg.channel as discord.TextChannel).permissionsFor(discordMsg.author);
        return Promise.resolve(userPermissions.has(PERMISSIONS[permission], true));
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

export class DiscordMessage implements IMessage {
    private nativeMessage: discord.Message;

    get BotID():string {
        return this.nativeMessage.client.user.id;
    }
    get ChannelID():string {
        return this.nativeMessage.channel.id;
    }
    get Text():string {
        return this.nativeMessage.toString();
    }
    get NativeMessage():discord.Message {
        return this.nativeMessage;
    }
    get AuthorID():string {
        return this.nativeMessage.author.id;
    }

    constructor(message: discord.Message) {
        this.nativeMessage = message;
    }
}