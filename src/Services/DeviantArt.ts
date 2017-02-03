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
import * as request from 'request';
import * as schedule from 'node-schedule';

let FeedParser = require('feedparser');

export class DeviantArt extends ContentService {
    protected serviceType = 'deviantart';
    private patternUser = new RegExp(/(?:http|https])*(?:\:\/\/)*([a-zA-Z0-9_\-]+)\.deviantart\.com(?:\/)*/i);

    constructor(protected subscriptions: Subscriptions, protected cmd: CommandLine, protected manager: ManagerBot) {
        super(cmd, '*/5 * * * *');

        this.initializeService();
    }

    protected urlBelongsToService(url: string): boolean {
        return url.indexOf("deviantart.com") > -1;
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
            var url = `http://backend.deviantart.com:80/rss.xml?type=deviation&q=by%3A${params.id}+sort%3Atime+meta%3Aall`;
            var req = request.head(url, { headers: { 'User-Agent': 'discord-bot' } }, (error, response, body: any) => {
                if (!error && response.statusCode == 200) {
                    resolve({
                        id: params.id,
                        type: type,
                        title: params.id
                    });
                }
                else reject(new NotFoundException("can't find deviantart user("));
            });
        });
    }

    protected getItemsByDate(type: string, channelId: string, publishedAfter: Date): Promise<IContentItem[]> {
        if (type === 'user') {
            var params: any = {
                channelId
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
            var results: IContentItem[] = [];
            var options = {
                url: `http://backend.deviantart.com:80/rss.xml?type=deviation&q=by%3A${params.channelId}+sort%3Atime+meta%3Aall`,
                headers: { 'User-Agent': 'discord-bot' }
            };

            request(options)
                .on('error', function (err) {
                    if (err) reject(err);
                })
                .on('response', function (res) {
                    if (res.statusCode != 200) {
                        reject(new NotFoundException('Deviantart response status: ' + res.statusCode));
                        return;
                    }

                    var stream = this;
                    var feedparser = new FeedParser();

                    feedparser.on('error', function (error) {
                        Log.write(error);
                    });

                    feedparser.on('readable', function () {
                        var stream = this
                            , meta = this.meta
                            , submission;

                        while (submission = stream.read()) {
                            var currentDate = new Date(submission.pubDate);
                            if (params.publishedAfter && currentDate <= params.publishedAfter) return;

                            results.push({
                                publishedAt: currentDate,
                                videoId: submission.link,
                                title: submission.title,
                                channelTitle: params.channelId,
                                channelId: params.channelId,
                                type: ContentItemType.image
                            });
                        }
                    });

                    feedparser.on('end', function (error) {
                        resolve(results);
                    });

                    stream.pipe(feedparser);
                });
        });
    }
}