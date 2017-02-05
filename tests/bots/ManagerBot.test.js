"use strict";
const ManagerBot_1 = require("../../src/bots/ManagerBot");
const chai_1 = require("chai");
const event = require("events");
class MockMessage {
    constructor() {
        this.BotID = 'test';
        this.ChannelID = 'foo';
        this.Text = 'bar';
        this.NativeMessage = {};
    }
}
class MockBot extends event.EventEmitter {
    constructor() {
        super();
        this.mockId = 'test';
    }
    connect() {
    }
    sendMessage(channelID, text, options) {
        return Promise.resolve(null);
    }
    replyMessage(sourceMessage, text, options) {
        return Promise.resolve(null);
    }
    sendFile(channelID, attachment, text) {
        return Promise.resolve(null);
    }
    checkMessagePermissions(message, permission) {
        return Promise.resolve(null);
    }
    emitOnline() {
        this.emit('online', this, this.mockId);
    }
}
exports.MockBot = MockBot;
class MockBot2 extends event.EventEmitter {
    constructor() {
        super();
        this.counter = 0;
        this.mockId = 'test2';
    }
    connect() {
    }
    sendMessage(channelID, text, options) {
        if (this.counter % 2 == 0) {
            this.counter++;
            return Promise.reject(null);
        }
        return Promise.resolve(null);
    }
    replyMessage(sourceMessage, text, options) {
        if (this.counter % 2 == 0) {
            this.counter++;
            return Promise.reject(null);
        }
        return Promise.resolve(null);
    }
    sendFile(channelID, attachment, text) {
        if (this.counter % 2 == 0) {
            this.counter++;
            return Promise.reject(null);
        }
        return Promise.resolve(null);
    }
    checkMessagePermissions(message, permission) {
        if (this.counter % 2 == 0) {
            this.counter++;
            return Promise.reject(null);
        }
        return Promise.resolve(null);
    }
    emitOnline() {
        this.emit('online', this, this.mockId);
    }
}
exports.MockBot2 = MockBot2;
const manager = new ManagerBot_1.ManagerBot();
const mockBot = new MockBot();
const mockBotResend = new MockBot2();
const mockMessage = new MockMessage();
describe('Manager Bot', () => {
    it('Should be empty at startup', () => {
        const result = manager.getBotByID('test');
        chai_1.expect(result).equal(undefined);
    });
    it('Should not return bot until it emit online', () => {
        manager.addBot(mockBot);
        var result = manager.getBotByID('test');
        chai_1.expect(result).equal(undefined);
    });
    it('Should return bot after it emit online', () => {
        mockBot.emitOnline();
        var result = manager.getBotByID('test');
        chai_1.expect(result).equal(mockBot);
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
//# sourceMappingURL=ManagerBot.test.js.map