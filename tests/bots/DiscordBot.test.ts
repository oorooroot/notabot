import { ManagerBot } from '../../src/Bots/ManagerBot';
import { DiscordBot } from '../../src/Bots/DiscordBot';
import { IBot } from '../../src/Bots/IBot';
import { IMessage } from '../../src/Bots/IMessage';
import { expect } from 'chai';
import * as event from 'events';

class DiscordClientMock extends event.EventEmitter {
    client = { id: 'test' };
    user: DiscordUserMock;
    channels = new Map<string, DiscordChannelMock>();
}

class DiscordMessageMock  {
    author: DiscordUserMock;
    mention: DiscordUserMock;

    isMentioned(user: DiscordUserMock): boolean {
        return this.mention == user;
    }
}

class DiscordUserMock  {
    
}

class DiscordChannelMock  {
    
}

const client = new DiscordClientMock();
const bot = new DiscordBot(client as any);

describe('Discord Bot', () => {
  it('Should be empty ID at startup', () => {
    expect(bot.ID).equal(undefined);
  });
});