import { ContentService, NotFoundException, IContentItem, IContentSource, ContentItemType } from "./Service";
import { CommandLine } from "../Utils/CommandLine";
import { Map } from "../Utils/Map";
import { Exception } from "../Utils/Exception";
import { Log } from "../Utils/Log";
import { RestClient } from "../Utils/Rest";
import { Helpers } from "../Utils/Helpers";
import { ISubscriptionsData, Subscriptions } from "./Subscriptions";
import { ManagerBot } from "../Bots/ManagerBot";
import { IMessage } from "../Bots/IMessage";
import * as schedule from 'node-schedule';
import * as process from 'process';

export class Twitch extends ContentService {
    protected serviceType = 'twitch';
    private headers = { Accept: "application/vnd.twitchtv.v3+json", "Client-ID": null };
    private patternUser = new RegExp(/(?:(?:http|https):\/\/){0,1}(?:www\.|){0,1}twitch\.tv\/([a-zA-Z0-9_\-]+)(?:\/[a-zA-Z0-9_\-]+)*/i);

    constructor(protected subscriptions: Subscriptions, protected cmd: CommandLine, protected manager: ManagerBot, protected rest: RestClient) {
        super(cmd, '*/3 * * * *');

        if(!process.env.TWITCH_KEY) {
            Log.write(`Failed to load ${this.serviceType} credentials, not initialized!`);
            return;
        }

        this.headers["Client-ID"] = process.env.TWITCH_KEY;
        this.initializeService();
    }

    protected urlBelongsToService(url: string): boolean {
        return url.indexOf("twitch.tv") > -1;
    }

    protected buildLinkFromId(id: string): string {
        return id;
    }

    protected getChannel(url: string, options?: any): Promise<any> {
        var arrMatches = url.match(this.patternUser);
        if (arrMatches && arrMatches.length > 0) {
            return this.getChannelByType('user', { id: arrMatches[1] });
        }
        return Promise.reject(new NotFoundException("unsupportable link type!"));
    }

    private getChannelByType(type: string, params?: any): Promise<IContentSource> {
        return this.rest.get("https://api.twitch.tv/kraken/channels/" + params.id, { headers: this.headers })
            .then<IContentSource>(data => {
                return { id: data.name, type: type, title: data.display_name };
            })
            .catch(err => {
                Log.write(err);
                throw new NotFoundException('cant find such ' + this.serviceType + ' ' + type + '!')
            });
    }

    protected getItemsByDate(type: string, channelId: string, publishedAfter: Date): Promise<IContentItem[]> {
        if (type === 'user') {
            var params: any = {
                channelId: channelId,
                limit: 10,
                offset: 0,
                broadcasts: false
            };
            if (publishedAfter) params.publishedAfter = publishedAfter;
            return this.getItems(type, params);
        }
        else {
            return Promise.reject("unsupported " + this.serviceType + " item type: " + type + "(!");
        }
    }

    protected getItems(type: string, params: any): Promise<IContentItem[]> {
        return new Promise<IContentItem[]>((resolve, reject) => {
            this.getItemsRecursively(type, params, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        })
            .then<IContentItem[]>(items => {
                return new Promise<IContentItem[]>((resolve, reject) => {
                    params.broadcasts = true;

                    this.getItemsRecursively(type, params, (err, result) => {
                        if (err) reject(err);
                        else {
                            resolve(items.concat(result));
                        }
                    });
                });
            });
    }

    private getItemsRecursively(type: string, params: any, callback: (err: any, items: IContentItem[]) => void, currentData?: { videos: IContentItem[] }, offset?: number) {
        if (!currentData) currentData = { videos: [] };
        var totalVideos: number, currentDate: Date;

        this.getItemsCurrentPage(params.channelId, type, { limit: params.limit, offset: offset || 0, broadcasts: params.broadcasts })
            .then(
            data => {
                totalVideos = data._total;

                return Promise.all(data.videos.map(value => {
                    currentDate = new Date(value.created_at);
                    if (params.publishedAfter && currentDate <= params.publishedAfter) return;

                    if (value.status === 'recording') {
                        currentData.videos.push({
                            publishedAt: currentDate,
                            videoId: `https://www.twitch.tv/` + params.channelId,
                            title: value.title,
                            channelTitle: value.channel.display_name,
                            channelId: params.channelId,
                            type: ContentItemType.stream
                        });
                    }
                    else {
                        currentData.videos.push({
                            publishedAt: currentDate,
                            videoId: value.url,
                            title: value.title,
                            channelTitle: value.channel.display_name,
                            channelId: params.channelId,
                            type: ContentItemType.video
                        });
                    }
                }));
            })
            .then(data => {
                if (totalVideos < (offset || 0) + params.limit || (currentDate && params.publishedAfter && currentDate < params.publishedAfter)) {
                    callback(null, currentData.videos);
                }
                else {
                    this.getItemsRecursively(type, params, callback, currentData, (offset || 0) + params.limit);
                }
            })
            .catch(err => {
                callback(err, null);
            });
    }

    private getItemsCurrentPage(channelId: string, type: string, params: any): Promise<{ videos: any[], _total: number }> {
        return this.rest.get(`https://api.twitch.tv/kraken/channels/${channelId}/videos`, { parameters: { limit: params.limit, offset: params.offset, broadcasts: params.broadcasts }, headers: this.headers });
    }
}