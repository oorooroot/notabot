import * as dotenv from 'dotenv';

import { ManagerBot } from './Bots/ManagerBot';
import { DiscordBot } from './Bots/DiscordBot';
import { TelegramBot } from './Bots/TelegramBot';

import { Database } from './Utils/Database';
import { CommandLine } from './Utils/CommandLine';
import { Log } from './Utils/Log';
import { RestClient } from './Utils/Rest';

import { Subscriptions } from './Services/Subscriptions';
import { TyanGenerator } from './Services/TyanGenerator';
import { Gestures } from './Services/Gestures';
import { YouTube } from './Services/YouTube';
import { Twitch } from './Services/Twitch';
import { Tumblr } from './Services/Tumblr';
import { DeviantArt } from './Services/DeviantArt';

import * as discord from 'discord.js';

dotenv.config();

var manager = new ManagerBot();
var cmd = new CommandLine(manager);
var rest = new RestClient();

var discordBot = new DiscordBot(new discord.Client());
manager.addBot(discordBot);
discordBot.connect();

var telegramBot = new TelegramBot();
manager.addBot(telegramBot);
telegramBot.connect();

var db = new Database("Database.db");
var tyanGenerator = new TyanGenerator(db, cmd, manager);
var gestures = new Gestures(db, cmd, manager);

var subscriptions = new Subscriptions(db);
var youtube = new YouTube(subscriptions, cmd, manager);
var twitch = new Twitch(subscriptions, cmd, manager, rest);
var deviantart = new DeviantArt(subscriptions, cmd, manager);
var tumblr = new Tumblr(subscriptions, cmd, manager);