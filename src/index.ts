import * as dotenv from 'dotenv';

import { ManagerBot } from './Bots/ManagerBot';
import { DiscordBot } from './Bots/DiscordBot';
import { TelegramBot } from './Bots/TelegramBot';

import { Database } from './Utils/Database';
import { Log } from './Utils/Log';
import { RestClient } from './Utils/Rest';

import { Subscriptions } from './Services/Subscriptions';
import { TyanGenerator } from './Services/TyanGenerator';
import { Gestures } from './Services/Gestures';
import { YouTube } from './Services/YouTube';
import { Twitch } from './Services/Twitch';
import { Tumblr } from './Services/Tumblr';
import { DeviantArt } from './Services/DeviantArt';

import * as path from 'path';
import * as process from 'process';

import * as discord from 'discord.js';

if (process.env.NODE_ENV) 
{
    Log.write("Development environment loaded.");
    dotenv.config({path: `.env.${process.env.NODE_ENV}`});
}
else dotenv.config({path: ".env.production"});

var manager = new ManagerBot();
var rest = new RestClient();

var discordBot = new DiscordBot(new discord.Client());
manager.addBot(discordBot);
discordBot.connect();

var telegramBot = new TelegramBot();
manager.addBot(telegramBot);
telegramBot.connect();

var db = new Database("Database.db");
var tyanGenerator = new TyanGenerator(db, manager);
var gestures = new Gestures(db, manager);

var subscriptions = new Subscriptions(db);
var youtube = new YouTube(subscriptions, manager);
var twitch = new Twitch(subscriptions, manager, rest);
var deviantart = new DeviantArt(subscriptions, manager);
var tumblr = new Tumblr(subscriptions, manager);