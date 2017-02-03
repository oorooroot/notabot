export class Helpers {
    static getName(inputClass) {
        var funcNameRegex = /function (.{1,})\(/;
        var results = (funcNameRegex).exec((<any> inputClass).constructor.toString());
        return (results && results.length > 1) ? results[1] : "";
    }

    static each<T>(array: T[], fn: (value: T, index: number, array:T[]) => any): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            if(array.length <= 0) resolve(array);
            else {
                array.forEach((v, i, a) => {
                    fn(v, i, a);
                    if(i + 1 === a.length) resolve(array);
                }); 
            }
        });
    }

}