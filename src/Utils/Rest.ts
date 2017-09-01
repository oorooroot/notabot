import * as request from 'request';

export class RestClient {

    constructor() {
    }

    public get(url: string, args: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            var options = {
                url,
                qs: args.parameters,
                headers: args.headers
            };
            request.get(options, (error, response, body) => {
                if(error) reject(new Error(error));
                else {
                    try {
                        var data = JSON.parse(body);
                    }
                    catch(e) {
                        reject(e);   
                    }
                    if (data && data.error) reject(new Error(data.error));
                    else resolve(data);
                }
            })
        });
    }
}