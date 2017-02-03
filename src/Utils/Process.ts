import * as events from 'events';

export interface IProccess {
    on(event: 'exit', listener: (sig?: string) => void): this;
    on(event: string, listener: Function): this;
}

export class Proccess extends events.EventEmitter implements IProccess {
    
    constructor() {
        super();

        [
            'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'
        ].forEach(this.terminatorSetup);
        
        process.on('exit', function() { this.terminator(); }); 
    }

    private terminatorSetup(element, index, array) {
        process.on(element, function() { this.terminator(element); });
    }

    private terminator(sig?) {
   		this.emit('exit', sig);
		process.exit(1);
    }
}