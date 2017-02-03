let rest = require('node-rest-client').Client;

export class RestClient {
    private c: any;

    constructor() {
        this.c = new rest();
    }

    public get(url: string, args: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.c.get(url, args, function (data, response) {
                if(data.error) reject(new Error(data.message));
                else resolve(data);
            });
        });
    }
}