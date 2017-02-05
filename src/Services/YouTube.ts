import { ContentService, NotFoundException, IContentItem, IContentSource, ContentItemType } from "./Service";
import { CommandLine } from "../Utils/CommandLine";
import { Map } from "../Utils/Map";
import { Log } from "../Utils/Log";
import { Helpers } from "../Utils/Helpers";
import { ISubscriptionsData, Subscriptions } from "./Subscriptions";
import { ManagerBot } from "../Bots/ManagerBot";
import { IMessage } from "../Bots/IMessage";
import * as fs from 'fs';

let google = require('googleapis');

const CREDENTIALS_PATH = __dirname + "/Credentials/youtube_secret.json";
type YoutubeResponsePart = "id" | "snippet";

export class YouTube extends ContentService {
    private youtube: any;
    protected serviceType = 'youtube';
    protected updateSchedule = '*/3 * * * *';

    private patternUser = new RegExp(/(?:http|https)+:\/\/(?:www\.|)youtube\.com\/user\/([a-zA-Z0-9_\-]+)/i);
    private patternChannel = new RegExp(/(?:http|https)+:\/\/(?:www\.|)youtube\.com\/channel\/([a-zA-Z0-9_\-]+)/i);
    private patternPlaylist = new RegExp(/(?:http|https)+:\/\/(?:www\.|)youtube\.com\/playlist\?list\=([a-zA-Z0-9_\-]+)/i);
    private types = { playlist: 'playlists', channel: 'channels' };
    private listTypes = { playlist: 'playlistItems', channel: 'activities' };

    constructor(protected subscriptions: Subscriptions, protected cmd: CommandLine, protected manager: ManagerBot) {
        super(cmd, '*/3 * * * *');
        
        try {
            var credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH).toString());
        }
        catch(err) {
            Log.write(`Failed to load ${this.serviceType} credentials, not initialized!`, err);
            return;
        }

        var jwtClient = new google.auth.JWT(credentials.client_email, null, credentials.private_key, ["https://www.googleapis.com/auth/youtube"], null);
        this.youtube = google.youtube('v3');

        jwtClient.authorize((err, tokens) => {
            if (err) {
                Log.write(err);
                return;
            }

            google.options({ auth: jwtClient });

            this.initializeService();
        });
    }
    
    protected urlBelongsToService(url: string): boolean {
        return url.indexOf("youtube.com") > -1;
    }

    protected buildLinkFromId(id: string): string {
        return `https://youtu.be/${id}`;
    }

    protected getChannel(url: string, options?: any): Promise<any> {
        var arrMatches = url.match(this.patternChannel);
        if (arrMatches && arrMatches.length > 0) {
            return this.getChannelByType('channel', { part: 'snippet', id: arrMatches[1] });
        }
        arrMatches = url.match(this.patternUser);
        if (arrMatches && arrMatches.length > 0) {
            return this.getChannelByType('channel', { part: 'snippet', forUsername: arrMatches[1] });
        }
        arrMatches = url.match(this.patternPlaylist);
        if (arrMatches && arrMatches.length > 0) {
            return this.getChannelByType('playlist', { part: 'snippet', id: arrMatches[1] });
        }
        return Promise.reject(new NotFoundException("unsupportable link type!"));
    }

    private getChannelByType(type: string, params?: any): Promise<IContentSource> {
        return new Promise<IContentSource>((resolve, reject) => {
            this.youtube[this.types[type]].list(params, (err, data) => {
                if (err) {
                    reject(err);
                }
                else if (data.items && data.items.length > 0) {
                    var item = data.items[0];
                    resolve({
                        id: item.id,
                        type: type,
                        title: item.snippet.title 
                    });
                }
                else {
                    reject(new NotFoundException('cant find such ' + this.serviceType + ' ' + type + '!'));
                }
            });
        });
    }

   protected getItemsByDate(type: string, channelId: string, publishedAfter: Date): Promise<IContentItem[]> {
        if (type === 'channel') {
            var params: any = {
                part: 'snippet, contentDetails',
                channelId: channelId,
                maxResults: 50
            };
            if (publishedAfter) params.publishedAfter = publishedAfter.toISOString();
            return this.getItems(type, params);
        }
        else if (type === 'playlist') {
            var params: any = {
                part: 'snippet',
                playlistId: channelId,
                maxResults: 50
            };
            return this.getItems(type, params)
            .then<IContentItem[]>(items => {
                return Promise.all(items.filter((value) => {
                    return value.publishedAt > publishedAfter;        
                }));
            });
        }
        else {
            return Promise.reject("unsupported " + this.serviceType + " item type: " + type + "(!");
        }
    }

    protected getItems(type: string, params: any): Promise<IContentItem[]> {
        return new Promise<IContentItem[]>((resolve, reject) => {
            this.getItemsRecursively(type, params, (err, result) => {
                if(err) reject(err);
                else resolve(result);
            });
        });
    }

    private getItemsRecursively(type: string, params: any, callback: (err:any, items: IContentItem[]) => void, currentData?: { videos: IContentItem[], pageToken?: string }) {
        if (currentData) params.pageToken = currentData.pageToken;
        else currentData = { videos: [] };

        var nextPageToken;

        this.getItemsCurrentPage(type, params)
        .then(
            data => {
                nextPageToken = data.nextPageToken;
                return Promise.all(data.items.map(value => {
                    if (type === 'channel' && value.snippet.type === "upload") { 
                        currentData.videos.push({ 
                            publishedAt: new Date(value.snippet.publishedAt),
                            videoId: value.contentDetails.upload.videoId,
                            title: value.snippet.title,
                            channelTitle: value.snippet.channelTitle,
                            channelId: params.channelId,
                            type: ContentItemType.video
                        })
                    }
                    else if (type === 'playlist') { 
                        currentData.videos.push({
                            publishedAt: new Date(value.snippet.publishedAt), 
                            videoId: value.snippet.resourceId.videoId, 
                            title: value.snippet.title, 
                            channelTitle: value.snippet.channelTitle,
                            channelId: params.playlistId,
                            type: ContentItemType.video
                        });
                    }
                }));
            }
        )
        .then(data => {
            if (nextPageToken) {
                currentData.pageToken = nextPageToken;
                this.getItemsRecursively(type, params, callback, currentData);
            }
            else callback(null, currentData.videos);
        })
        .catch(err => {
            callback(err, null);    
        });
    }

    private getItemsCurrentPage(type: string, params: any): Promise<{ items: any[], nextPageToken?: string }> {
        return new Promise<{ items: IContentItem[], nextPageToken?: string }>((resolve, reject) => {
            this.youtube[this.listTypes[type]].list(params, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }
}