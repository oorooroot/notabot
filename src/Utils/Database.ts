import * as sqlite from 'sqlite3';
import * as util from 'util';
import * as process from 'process';
import { Log } from './Log';
import { Exception } from './Exception';

sqlite.verbose();

export class Database {
    private db: sqlite.Database;

    constructor(private filename: string) {
        this.db = new sqlite.Database(process.env.DB_PATH);
    }
    
    exec(sql:string): Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            this.db.exec(sql, error => {
                if(error) reject(error);
                else resolve();
            })
        }.bind(this));
    }

    all(q:QuerySetup): Promise<any[]> {
        return new Promise<any[]>(function(resolve, reject) { 
            this.db.all(q.sql, q.args, (err, rows) => {
                if(err) reject(err);
                else resolve(rows);
            });
        }.bind(this));    
    }

    required(q:QuerySetup): Promise<QueryResult> {
        return new Promise<QueryResult>(function(resolve, reject) {
            this.db.run(q.sql, q.args, function(err, rows) {
                if(err || this.changes == 0 ) reject(err || new NoRowsAffectedDatabaseException('No rows affected:\n' + q.sql + '\n' + util.inspect(q.args)));
                resolve({lastId: this.lastId, changes: this.changes});
            });
        }.bind(this));
    }

    result(q:QuerySetup): Promise<QueryResult> {
        return new Promise<QueryResult>(function(resolve, reject) {
            this.db.run(q.sql, q.args, function(err, rows) {
                if(err) reject(err);
                resolve({lastId: this.lastId, changes: this.changes});
            });
        }.bind(this));
    }

    select(table:string, fields?:string[], where?:KeyValueArg<any>, order?:string[], limit?: number, group?:string[]): Promise<any[]> {
        return this.buildSimpleSql(QueryType.Select, table, fields, null, where, order, limit, group)
        .then<any[]>( this.all.bind(this) );
    }

    update(table:string, set:KeyValueArg<any>, where?:KeyValueArg<any>): Promise<QueryResult> {
        return this.buildSimpleSql(QueryType.Update, table, null, set, where, null)
        .then<QueryResult>( this.result.bind(this) );
    }
    
    insert(table:string, set:KeyValueArg<any>): Promise<QueryResult> {
        return this.buildSimpleSql(QueryType.Insert, table, null, set, null, null)
        .then<QueryResult>( this.required.bind(this) );
    } 

    delete(table:string, where:KeyValueArg<any>):Promise<QueryResult> {
        return this.buildSimpleSql(QueryType.Delete, table, null, null, where, null)
        .then<QueryResult>( this.result.bind(this) );
    }

    private buildSimpleSql(type:QueryType, table:string, fields?:string[], set?:KeyValueArg<any>, where?:KeyValueArg<any>, order?:string[], limit?: number, group?:string[]): Promise<QuerySetup> {
        
        return new Promise<QuerySetup>((resolve, reject) => {
            var sql = '', args = [];
            switch(type) {
                case QueryType.Select: sql += "SELECT"; break;
                case QueryType.Insert: sql += "INSERT INTO"; break;
                case QueryType.Update: sql += "UPDATE"; break;
                case QueryType.Delete: sql += "DELETE FROM"; break;
                default: return;
            }

            if(type == QueryType.Select) {
                if (!fields) sql += " * FROM";
                else {
                    var fieldsString = '';
                    for(var field in fields) {
                        fieldsString += fieldsString == '' ? ' ' + fields[field] : ', ' + fields[field];
                    } 
                    
                    sql += fieldsString + " FROM";
                }
            }

            sql += " " + table;
            
            if(set && type == QueryType.Insert) {
                var insertFieldsString = '';
                var insertValuesString = '';

                for(var key in set) {
                    insertFieldsString += insertFieldsString == '' ? '' + key : ', ' + key;
                    insertValuesString += insertValuesString == '' ? '?' : ', ?';
                    args.push(set[key]);
                }

                sql += " (" + insertFieldsString + ") VALUES (" + insertValuesString + ")";
            }

            if(set && type == QueryType.Update) {
                var setString = '';
                for(var key in set) {
                    setString += setString == '' ? ' ' + key + ' = ?' : ', ' + key + ' = ?';
                    args.push(set[key]);
                }

                sql += " SET" + setString;
            }

            if(where) {
                var whereString = '';
                for(var key in where) {
                    if(where[key] instanceof WhereFieldSetting) {
                        var c = (where[key] as WhereFieldSetting)
                        whereString += whereString == '' ? ` ${c.leftValue} ${c.comparison} ?` : ` AND ${c.leftValue} ${c.comparison} ?`;
                        args.push(c.rightValue);
                    } else {
                        whereString += whereString == '' ? ' ' + key + ' = ?' : ' AND ' + key + ' = ?';
                        args.push(where[key]);
                    }
                }
                sql += " WHERE" + whereString;
            }

            if(type == QueryType.Select && group) {
                var groupString = '';
                for(var key in group) {
                    groupString += groupString == '' ? ' ' + group[key] : ', ' + group[key];
                }
                sql += " GROUP BY" + groupString;
           }

            if(order) {
                var orderString = '';
                for(var o in order) {
                    var orderValue = order[o];
                    if(orderValue === "RANDOM()"){
                        orderString += orderString == '' ? ` ${orderValue}` : `, ${orderValue}`;
                    }
                    else {
                        orderString += orderString == '' ? ' ?' : ', ?';
                        args.push(orderValue);
                    }
                } 
                
                sql += " ORDER BY" + orderString;
            }

            if(limit && type == QueryType.Select) {
                sql += " LIMIT " + limit.toString();
            }

            //sql += ';\n';

            if (sql == '') reject("Failed to build simple SQL query!");
            else resolve({ sql:sql, args:args });
        });
    }
}

enum QueryType {
    Select,
    Insert,
    Update,
    Delete
}

export class DatabaseException extends Exception {
    constructor(message?: string) {
        super(message);
        this.name = 'DatabaseException';
    }    
} 

export class NoRowsAffectedDatabaseException extends DatabaseException {
    constructor(message?: string) {
        super(message);
        this.name = 'NoRowsAffectedDatabaseException';
    }    
} 

type QuerySetup = {
    sql: string;
    args: any[];
}

export type QueryResult = {
    lastId: number;
    changes: number;
}

export interface KeyValueArg<T> {
    [K: string]: T;
}

export class WhereFieldSetting {
    constructor(
        public leftValue: string,
        public comparison: string,
        public rightValue: string
    ) {

    }
}