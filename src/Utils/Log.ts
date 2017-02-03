import * as util from 'util';

export class Log {

    public static write(...args: any[]) {
        var out: string = '';
        for(var i = 0; i < args.length; i++) {
            out += util.inspect(args[i]) + ' ';
        }
        console.log("[" + (new Date()).toLocaleString() + "]", out);
    }

}