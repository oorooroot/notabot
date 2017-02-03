export class Exception implements Error {
    public name: string;
    public message: string;
    constructor(message?: string) {
        this.message = message;
        this.name = 'Exception';
    }    
    toString() {
        return this.name + ': ' + this.message;
    }
} 