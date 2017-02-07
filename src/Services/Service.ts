import { Map } from "../Utils/Map";
import { CommandLine } from "../Utils/CommandLine";
import { IMessage } from "../Bots/IMessage";
import { ManagerBot } from "../Bots/ManagerBot";
import { Exception } from "../Utils/Exception";
import { WhereFieldSetting } from "../Utils/Database";
import { ISubscriptionsData, Subscriptions } from "./Subscriptions";
import { Log } from "../Utils/Log";
import * as schedule from 'node-schedule';

export abstract class Service {
    protected abstract serviceType: string;
    protected abstract commands: Map<{ role: string, f: (source: IMessage, args: string[]) => any }>;
    protected abstract manager: ManagerBot;
    protected isInitialized: boolean = false;

    protected initializeService() {
        this.isInitialized = true;
        Log.write(`${this.serviceType} service initialized successfully.`);
    }

    protected proccessCommand(command: string, source: IMessage, params: string[]) {
        if(!this.isInitialized) return;
        
        var commandSettnigs = this.commands[command];
        this.manager.checkMessagePermissions(source, commandSettnigs.role)
            .then(havePermission => { if (havePermission) commandSettnigs.f(source, params) });
    }
}

export enum ContentItemType {
    video,
    stream,
    image
}

export interface IContentItem {
    channelId: string,
    publishedAt: Date;
    videoId: string;
    title: string;
    type: ContentItemType | string;
    channelTitle?: string;
}

export interface IContentSource {
    id: string;
    type: string;
    title: string;
}

export abstract class ContentService extends Service {
    protected abstract subscriptions: Subscriptions;

    protected commands: Map<{ role: string, f: (source: IMessage, args: string[]) => any }> = {
        subscribe: { role: 'user', f: this.processSubscribeMessage.bind(this) },
        unsubscribe: { role: 'admin', f: this.processUnsubscribeMessage.bind(this) },
        refresh: { role: 'admin', f: this.processRefreshSubscriptions.bind(this) },
        list: { role: 'user', f: this.processListSubscriptions.bind(this) }
    };

    constructor(cmd: CommandLine, updateSchedule: string, debug?:boolean) {
        super();

        cmd.on('subscribe', (source: IMessage, params: string[]) => {
            if (!params[0] || !this.urlBelongsToService(params[0])) return;
            this.proccessCommand('subscribe', source, params);
        });

        cmd.on('unsubscribe', (source: IMessage, params: string[]) => {
            if (!params[0] || !this.urlBelongsToService(params[0])) return;
            this.proccessCommand('unsubscribe', source, params);
        });

        cmd.on('list', (source, args) => {
            this.proccessCommand('list', source, args);
        });

        cmd.on('refresh', (source, args) => {
            this.proccessCommand('refresh', source, args);
        });

        if(debug || true) {
            schedule.scheduleJob(updateSchedule, () => {
                this.refreshSubscriptions();
            });
        }
    }

    protected processListSubscriptions(source: IMessage, params: string[]) {
        var message = "";

        this.subscriptions.get({
            botId: source.BotID,
            botChannelId: source.ChannelID,
            serviceType: this.serviceType
        })
        .then(items => {
            return Promise.all(items.map(value => {
                message += value.serviceItemType + ' "' + value.serviceTitle + '" ' + value.url + '\n';
            }));
        })
        .then(items => {
            if (message !== "") this.manager.replyMessage(source, 'current ' + this.serviceType + ' subscriptions are:\n' + message);
        })
        .catch(err => {
            Log.write(err);
        });
    }

    protected processRefreshSubscriptions(source: IMessage, params: string[]) {
        this.refreshSubscriptions({ botId: source.BotID, botChannelId: source.ChannelID });
    }

    protected refreshSubscriptions(options?: { botId: string, botChannelId: string }) {
        var filter: any = {
            serviceType: this.serviceType
        };
        if (options) {
            filter.botId = options.botId;
            filter.botChannelId = options.botChannelId;
        }

        var maxDates: any[], subscriptionsData: ISubscriptionsData[];

        this.subscriptions.get(filter, ["serviceId", "serviceItemType", "MAX(serviceLastUpdate) AS serviceLastUpdate"], null, ["serviceId", "serviceItemType"])
            .then(items => {
                maxDates = items;
            })
            .then(() => {
                return this.subscriptions.get(filter);
            })
            .then(items => {
                subscriptionsData = items;
            })
            .then(() => {
                return Promise.all(maxDates.map((maxDate) => {
                    return this.getItemsByDate(maxDate.serviceItemType, maxDate.serviceId, new Date(maxDate.serviceLastUpdate));
                }));
            })
            .then(results => {
                return Promise.all(results.map((videos) => {
                    return Promise.all(videos.map((video) => {
                        return Promise.all(subscriptionsData.map((subscription) => {
                            if (video.channelId === subscription.serviceId && video.publishedAt > new Date(subscription.serviceLastUpdate)) {
                                var where = {
                                    botId: subscription.botId,
                                    botChannelId: subscription.botChannelId,
                                    serviceType: subscription.serviceType,
                                    serviceId: subscription.serviceId,
                                    serviceItemType: subscription.serviceItemType,
                                    serviceLastUpdate: new WhereFieldSetting('serviceLastUpdate', '<' , video.publishedAt.toISOString())
                                };
                                
                                var message = "";
                                switch(video.type) {
                                    case ContentItemType.video:
                                        message = `${this.serviceType} ${subscription.serviceItemType} "${video.channelTitle}" uploaded new video "${video.title}" ` + this.buildLinkFromId(video.videoId);
                                    break;
                                    case ContentItemType.stream:
                                        message = `${this.serviceType} ${subscription.serviceItemType} "${video.channelTitle}" is streaming "${video.title}" now: ` + this.buildLinkFromId(video.videoId);
                                    break;
                                    case ContentItemType.image:
                                        message = `${this.serviceType} ${subscription.serviceItemType} "${video.channelTitle}" submitted new image "${video.title}" ` + this.buildLinkFromId(video.videoId);
                                    break;
                                    default:
                                        message = `${this.serviceType} ${subscription.serviceItemType} "${video.channelTitle}" uploaded new item "${video.title}" ` + this.buildLinkFromId(video.videoId);
                                    break;
                                }

                                return Promise.all([
                                    this.manager.sendMessage(subscription.botId, subscription.botChannelId, message),
                                    this.subscriptions.update({ serviceLastUpdate: video.publishedAt.toISOString() }, where)
                                ]);
                            } else {
                                Promise.resolve();
                            }
                        }));
                    }));
                }));
            })
            .catch(err => {
                Log.write(err);
            });
    }

    protected processSubscribeMessage(source: IMessage, params: string[]) {
        var itemType;

        this.getChannel(params[0])
        .then(item => {
            itemType = item.type;

            return this.subscriptions.add({
                url: params[0],
                botId: source.BotID,
                botChannelId: source.ChannelID,
                serviceId: item.id,
                serviceType: this.serviceType,
                serviceItemType: item.type,
                serviceTitle: item.title
            });
        })
        .then(() => {
            this.manager.replyMessage(source, `successfully subscribed ${itemType}!`);
            return Promise.resolve();
        })
        .catch(err => {
            if(err instanceof NotFoundException) {
                this.manager.replyMessage(source, err.message);
            } else {
                Log.write(err);
                this.manager.replyMessage(source, `failed to subscribe, sorry!`);
            }
        });
    }

    protected processUnsubscribeMessage(source: IMessage, params: string[]) {
        var itemType;

        this.getChannel(params[0])
        .then(item => {
            itemType = item.type;
            return this.subscriptions.delete({
                botId: source.BotID,
                botChannelId: source.ChannelID,
                serviceId: item.id,
                serviceType: this.serviceType,
                serviceItemType: item.type
            });
        })
        .then(result => {
            if(result.changes === 0) this.manager.replyMessage(source, `no subscribtion registered for this ${itemType}!`);
            else this.manager.replyMessage(source, `successfully unsubscribed ${itemType}!`);
        })
        .catch(err => {
            if(err instanceof NotFoundException) {
                this.manager.replyMessage(source, err.message);
            } else {
                Log.write(err);
                this.manager.replyMessage(source, `failed to unsubscribe, sorry!`);
            }
        });
    }

    protected abstract getItemsByDate(type: string, channelId: string, publishedAfter: Date): Promise<IContentItem[]>;
    protected abstract getChannel(url: string, options?: any): Promise<IContentSource>;
    
    protected abstract buildLinkFromId(id: string): string;
    protected abstract urlBelongsToService(url: string): boolean;
}

export class NotFoundException extends Exception {
    constructor(message?: any) {
        super(message);
        this.name = 'NotFoundException';
    }
}