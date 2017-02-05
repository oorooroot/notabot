import { ManagerBot } from '../../src/bots/ManagerBot';
import { IBot } from '../../src/bots/IBot';
import { IMessage } from '../../src/bots/IMessage';
import { expect } from 'chai';
import * as event from 'events';

class MockMessage implements IMessage {
    BotID = 'test';
    ChannelID = 'foo';
    Text = 'bar';
    NativeMessage = {};
}

export class MockBot extends event.EventEmitter implements IBot {
    ID:string;

    constructor() {
      super();
    }

    connect() {

    }
    sendMessage(channelID: string, text: string, options?: any): Promise<any> {
        return Promise.resolve(null);
    }
    replyMessage(sourceMessage:IMessage, text: string, options?: any): Promise<any> {
        return Promise.resolve(null);
    }
    sendFile(channelID: string, attachment: string, text?:string): Promise<any> {
        return Promise.resolve(null);
    }
    checkMessagePermissions(message:IMessage, permission: string): Promise<boolean> {
        return Promise.resolve(null);
    }

    mockId = 'test';
    emitOnline() {
      this.emit('online', this, this.mockId);
    }
}

export class MockBot2 extends event.EventEmitter implements IBot {
    ID:string;
    counter = 0;
    constructor() {
      super();
    }

    connect() {

    }
    sendMessage(channelID: string, text: string, options?: any): Promise<any> {
        if(this.counter % 2 == 0) { this.counter++; return Promise.reject(null); }
        return Promise.resolve(null);
    }
    replyMessage(sourceMessage:IMessage, text: string, options?: any): Promise<any> {
        if(this.counter % 2 == 0) { this.counter++; return Promise.reject(null); }
        return Promise.resolve(null);
    }
    sendFile(channelID: string, attachment: string, text?:string): Promise<any> {
        if(this.counter % 2 == 0) { this.counter++; return Promise.reject(null); }
        return Promise.resolve(null);
    }
    checkMessagePermissions(message:IMessage, permission: string): Promise<boolean> {
        if(this.counter % 2 == 0) { this.counter++; return Promise.reject(null); }
        return Promise.resolve(null);
    }

    mockId = 'test2';
    emitOnline() {
      this.emit('online', this, this.mockId);
    }
}

const manager = new ManagerBot();
const mockBot = new MockBot();
const mockBotResend = new MockBot2();
const mockMessage = new MockMessage();

describe('Manager Bot', () => {
  it('Should be empty at startup', () => {
    const result = manager.getBotByID('test');
    expect(result).equal(undefined);
  });
  
  it('Should not return bot until it emit online', () => {
    manager.addBot(mockBot);
    var result = manager.getBotByID('test');
    expect(result).equal(undefined);
  });

  it('Should return bot after it emit online', () => {
    mockBot.emitOnline();
    var result = manager.getBotByID('test');
    expect(result).equal(mockBot);
  });

  it('Should resolve send message at defined bot', () => {
    return manager.sendMessage('test', 'bar', 'baz');
  });

  it('Should reject send message at undefined bot', (done) => {
    manager.sendFile('foo', 'bar', 'baz')
    .then(() => {
      throw new Error('was not supposed to succeed');
    })
    .catch(err => {
      done();
    });
  });
  
  it('Should resolve send file at defined bot', () => {
    return manager.sendMessage('test', 'bar', 'baz');
  });

  it('Should reject send file at undefined bot', (done) => {
    manager.sendFile('foo', 'bar', 'baz')
    .then(() => {
      throw new Error('was not supposed to succeed');
    })
    .catch(err => { done(); });
  });

  it('Should resolve check message permissions', () => {
    return manager.checkMessagePermissions(mockMessage, 'user');
  });

  it('Should fail on check undefined message permissions', (done) => {
    manager.checkMessagePermissions(null, 'user')
    .catch(err => { done(); });
  });

  it('Should resend any type successfully', () => {
    manager.addBot(mockBotResend);
    mockBotResend.emitOnline();
    return Promise.all([
      manager.sendMessage('test2', 'bar', 'baz'),
      manager.sendFile('test2', 'bar', 'baz'),
      manager.replyMessage(mockMessage, 'bar')
    ]);
  });
  
});