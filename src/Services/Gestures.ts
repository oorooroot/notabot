import { DatabaseTable, DatabaseDefinition } from "../Utils/DatabaseTable";
import { Database, KeyValueArg, QueryResult, NoRowsAffectedDatabaseException } from "../Utils/Database";
import { CommandLine } from "../Utils/CommandLine";
import { ManagerBot } from "../Bots/ManagerBot";
import { IMessage } from "../Bots/IMessage";
import { Map } from "../Utils/Map";
import { Log } from "../Utils/Log";
import * as fs from 'fs';
import * as pegjs from 'pegjs';

const MAX_TIMELIMIT = 1000 * 60 * 60 * 6;
const IMAGE_LINKS = __dirname + "/Gestures.json";

const TABLE_NAME: string = "gestures_settings";

export class GestureSessionData {
    id: number;
    botId: string;
    botChannelId: string;
    gestureStart: number;
    timelimit: number;
}

@DatabaseDefinition({
    id: { type: "INTEGER", typeExtension: "PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE" },
    botId: { type: "VARCHAR" },
    botChannelId: { type: "VARCHAR" },
    gestureStart: { type: "DATETIME" },
    timelimit: { type: "INTEGER" }
})
export class Gestures extends DatabaseTable {
    private commands: Map<{ role: string, f: (source: IMessage, args: string[]) => any }> = {
        gesture: { role: 'user', f: this.proccessGestureStart.bind(this) },
    };

    private picTree = {
        female: {
            nude: [],
            clothed: []
        },
        male: {
            nude: [],
            clothed: []
        }
    };

    private activeTimelimits: GestureSessionData;
    private help = `gesture command: gesture female|male|any nude|clothed|any [Nh] [Nm] [Ns]
    example: gesture female clothed 2m 30s`;

    constructor(protected db: Database, protected cmd: CommandLine, protected manager: ManagerBot) {
        super(db, TABLE_NAME);
        this.initializeGestures();

        this.cmd.registerCommand("gesture");
    }

    private proccessHelp(source:IMessage, params:string[]) {
        this.manager.replyMessage(source, this.help);
    }

    private proccessCommand(command: string, source: IMessage, params: string[]) {
        var commandSettnigs = this.commands[command];
        this.manager.checkMessagePermissions(source, commandSettnigs.role)
        .then(havePermission => { if(havePermission) commandSettnigs.f(source, params) });
    }

    private initializeGestures() {
        var pictures = JSON.parse(fs.readFileSync(IMAGE_LINKS).toString());
        for (var i = 0; i < pictures.length; i++) {
            var item = pictures[i];
            if (item.categories[0] === 'both') {
                this.picTree['female'][item.categories[1] === 'partial' ? 'nude' : item.categories[1]].push(item['image']);
                this.picTree['male'][item.categories[1] === 'partial' ? 'nude' : item.categories[1]].push(item['image']);
            }
            else {
                this.picTree[item.categories[0]][item.categories[1] === 'partial' ? 'nude' : item.categories[1]].push(item['image']);
            }
        }
        
        this.checkSessionsAtStartup();

        this.cmd.on('гестура', (source: IMessage, params: string[]) => {
            if(params[0] === 'help') this.proccessHelp(source, params);
            else this.proccessCommand('gesture', source, params);
        });
        this.cmd.on('gesture', (source: IMessage, params: string[]) => {
            if(params[0] === 'help') this.proccessHelp(source, params);
            else this.proccessCommand('gesture', source, params);
        });
    }

    private proccessGestureStart(source: IMessage, params: string[]) {
        
        var gestureData:{ link: string, timelimit: number, timelimitString: string };
        
        this.getActiveSessions({botId: source.BotID, botChannelId: source.ChannelID})
        .then(
            activeSessions => {
                if(!activeSessions || activeSessions.length == 0) {
                    this.getGestureData(source.Text)
                    .then(gestureDataRes => { gestureData = gestureDataRes; })
                    .then(() => { return this.subscribeGesturePreset(source.BotID, source.ChannelID, gestureData.timelimit)})
                    .then(() => { this.manager.sendMessage(source.BotID, source.ChannelID, "Ok! Just get ready for drawing, in 10 seconds..."); })
                    .then(() => { return this.promiseDelay(10000); })
                    .then(() => { return this.manager.sendFile(source.BotID, source.ChannelID, gestureData.link); })
                    .then(() => { return this.manager.sendMessage(source.BotID, source.ChannelID, `Timelimit set for ${gestureData.timelimitString}, gl!`); })
                    .then(() => { return this.subscribeGestureStart(source.BotID, source.ChannelID, gestureData.timelimit)})
                    .then(() => { return this.subscribeGestureEnd(source.BotID, source.ChannelID, gestureData.timelimit)})
                    .catch( error => {
                        Log.write(error);
                    });
                }
                else {
                    this.manager.replyMessage(source, "Only one gesture per time, you can participate in currently running session!");
                }
            }
        )

    }

    private promiseDelay(delay: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, delay);
        });
    }

    private checkSessionsAtStartup() {
        this.getActiveSessions()
        .then(this.subscribeSessionsEnd.bind(this));
    }

    private isSessionStarted(): Promise<boolean> {
        return this.getActiveSessions()
        .then(result => {
            return result.length > 0;
        });
    }

    private getGestureData(commandText: string): Promise<{ link: string, timelimit: number, timelimitString: string }> {
        return new Promise<{ link: string, timelimit: number, timelimitString: string }>((resolve, reject) => {
            var r = /(gesture|гестура)\s(female|male|женщина|мужчина|any|любая|любой)\s(nude|any|clothed|голая|голый|одетая|одетый|любая|любой)(?:\s(\d+)(?:h|ч))*(?:\s(\d+)(?:m|м))*(?:\s(\d+)(?:s|с))*/ig;
            var match = r.exec(commandText);
            if(!match) {
                reject();
            }
            else {
                var data = [];

                match[2] = match[2].replace("женщина", "female");
                match[2] = match[2].replace("мужчина", "male");
                match[2] = match[2].replace("любая", "any");
                match[2] = match[2].replace("любой", "any");
                match[3] = match[3].replace("голая", "nude");
                match[3] = match[3].replace("голый", "nude");
                match[3] = match[3].replace("одетая", "clothed");
                match[3] = match[3].replace("одетый", "clothed");
                match[3] = match[3].replace("любая", "any");
                match[3] = match[3].replace("любой", "any");

                if (match[2] === 'any') {
                    if (match[3] === 'any') {
                        data.push(this.picTree.female.nude);
                        data.push(this.picTree.female.clothed);
                        data.push(this.picTree.male.nude);
                        data.push(this.picTree.male.clothed);
                    }
                    else {
                        data.push(this.picTree.female[match[3]]);
                        data.push(this.picTree.male[match[3]]);
                    }
                }
                else {
                    if (match[3] === 'any') {
                        data.push(this.picTree[match[2]].nude);
                        data.push(this.picTree[match[2]].clothed);
                    }
                    else {
                        data.push(this.picTree[match[2]][match[3]]);
                    }
                }

                var totalcount = 0;
                for(var i = 0; i < data.length; i++)
                {
                    totalcount += data[i].length;
                }

                var rand = Math.floor(Math.random() * totalcount);
                for(var i = 0; i < data.length; i++)
                {
                    if (rand >= data[i].length) rand -= data[i].length;
                    else 
                    {
                        break;
                    }
                }

                var link = data[i][rand];

                var timelimit = 0;
                if(match[4]) {
                    timelimit += Number(match[4]) * 1000 * 60 * 60;
                }
                if(match[5]) {
                    timelimit += Number(match[5]) * 1000 * 60;
                }
                if(match[6]) {
                    timelimit += Number(match[6]) * 1000;
                }

                timelimit = Math.min(timelimit, MAX_TIMELIMIT);
                
                var x = timelimit / 1000; var seconds = Math.floor(x % 60); x /= 60; var minutes = Math.floor(x % 60); x /= 60; var hours = Math.floor(x % 24); x /= 24; var days = Math.floor(x);
                var timelimitString = '' + (days > 0 ? days + ' days' : ''); timelimitString += (hours > 0 ? (timelimitString === '' ? '': ' ') + hours + ' hours' : ''); timelimitString += (minutes > 0 ? (timelimitString === '' ? '': ' ') + minutes + ' minutes' : ''); timelimitString += (seconds > 0 ? (timelimitString === '' ? '': ' ') + seconds + ' seconds' : '');

                resolve({ link, timelimit, timelimitString });
            }
        });
    }

    private getActiveSessions(where?: { botId?: string, botChannelId?: string }): Promise<GestureSessionData[]> {
        return this.db.select(TABLE_NAME, null, where);
    }

    private subscribeSessionsEnd(sessionAray: GestureSessionData[]): Promise<void[]> {
        return Promise.all(sessionAray.map( (session) => {
            this.subscribeGestureEnd(session.botId, session.botChannelId, Math.max(session.timelimit - ((new Date).getTime() - session.gestureStart), 1));
        }));
    }

    private subscribeGesturePreset(botId: string, botChannelId: string, timelimit: number) {
        return this.db.delete(TABLE_NAME, {botId, botChannelId})
        .then(() => { return this.db.insert(TABLE_NAME, {botId, botChannelId, gestureStart: new Date(), timelimit})});
    }

    private subscribeGestureStart(botId: string, botChannelId: string, timelimit: number) {
        return this.db.delete(TABLE_NAME, {botId, botChannelId})
        .then(() => { return this.db.insert(TABLE_NAME, {botId, botChannelId, gestureStart: new Date(), timelimit})});
    }

    private subscribeGestureEnd(botId: string, botChannelId: string, timelimit: number) {
        setTimeout(() => {
            this.db.delete(TABLE_NAME, {botId: botId, botChannelId: botChannelId});
            this.manager.sendMessage(botId, botChannelId, "Timelimit hit! No more drawing, I said!");
        }, timelimit);
    }
}