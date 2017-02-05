import * as util from 'util';
import * as process from 'process';

export class Log {

    public static write(...args: any[]) {
        if(process.env.NODE_ENV === 'testing') return;
        var out: string = '';
        for(var i = 0; i < args.length; i++) {
            out += util.inspect(args[i]) + ' ';
        }
        console.log("[" + (new Date()).toLocaleString() + "]", out);
    }

}