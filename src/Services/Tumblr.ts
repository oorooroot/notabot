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
import * as fs from 'fs';
import * as schedule from 'node-schedule';
import * as tumblr from 'tumblr.js';

const CREDENTIALS_PATH = __dirname + "/Credentials/tumblr_secret.json";

export class Tumblr extends ContentService {
    protected serviceType = 'tumblr';
    protected client: any;
    private patternUser = new RegExp(/(?:http|https)+:\/\/(?:www\.|)([a-zA-Z0-9_\-]+).tumblr\.com(?:\/[a-zA-Z0-9_\-]+)*/i);

    constructor(protected subscriptions: Subscriptions, protected cmd: CommandLine, protected manager: ManagerBot) {
        super(cmd, '*/3 * * * *');

        try {
            var credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH).toString());
        }
        catch(err) {
            Log.write(`Failed to load ${this.serviceType} credentials, not initialized!`, err);
            return;
        }

        this.client = new tumblr.createClient({ consumer_key: credentials.consumer_key });

        this.initializeService();
    }

    protected urlBelongsToService(url: string): boolean {
        return url.indexOf("tumblr.com") > -1;
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
        return new Promise<IContentSource>((resolve, reject) => {
            this.client.blogInfo(params.id, (err, data) => {
                if (err) reject(new NotFoundException(err));
                else resolve({
                    id: data.blog.name,
                    type: type,
                    title: data.blog.title
                });
            });
        });

    }

    protected getItemsByDate(type: string, channelId: string, publishedAfter: Date): Promise<IContentItem[]> {
        if (type === 'user') {
            var params: any = {
                channelId: channelId,
                limit: 15,
                offset: 0
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
        });
    }

    private getItemsRecursively(type: string, params: any, callback: (err: any, items: IContentItem[]) => void, currentData?: { videos: IContentItem[] }, offset?: number) {
        if (!currentData) currentData = { videos: [] };
        var totalPosts: number, currentDate: Date;

        this.getItemsCurrentPage(params.channelId, type, { limit: params.limit, offset: offset || 0 })
            .then(
            data => {
                totalPosts = data.total_posts;

                return Promise.all(data.posts.map(value => {
                    currentDate = new Date(value.date);
                    if (params.publishedAfter && currentDate <= params.publishedAfter) return;

                    currentData.videos.push({
                        publishedAt: currentDate,
                        videoId: value.short_url,
                        title: value.summary,
                        channelTitle: value.blog_name,
                        channelId: params.channelId,
                        type: value.type
                    });
                }));
            })
            .then(data => {
                if (totalPosts < (offset || 0) + params.limit || (currentDate && params.publishedAfter && currentDate < params.publishedAfter)) {
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

    private getItemsCurrentPage(channelId: string, type: string, params: any): Promise<{ blog: any, posts: any[], total_posts: number }> {
        return new Promise<{ blog: any, posts: any[], total_posts: number }>((resolve, reject) => {
            this.client.blogPosts(channelId, { limit: params.limit, offset: params.offset }, (err, data) => {
                if (err) reject(new NotFoundException(err));
                else resolve(data);
            });
        });
    }
}
