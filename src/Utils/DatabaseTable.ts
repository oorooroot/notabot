import { Database } from "./Database";
import { Log } from "./Log";
import { Map } from "./Map";

import "reflect-metadata";

export interface IDatabaseFieldsDefinition {
    [K: string]: IDatabaseField;
}

export interface IDatabaseField {
    type: DatabaseFieldType;
    typeExtension?: string;
}

export type DatabaseFieldType = "BLOB" | "INTEGER" | "TEXT" | "REAL" | "NUMERIC" | "DATETIME" | "VARCHAR";
export const DatabaseDefinitionMetadataKey = "DatabaseDefinition";

export function DatabaseDefinition(definition: IDatabaseFieldsDefinition): any {
    return Reflect.metadata(DatabaseDefinitionMetadataKey, definition);
}

function getDatabaseDefinition(target: any): IDatabaseFieldsDefinition {
    return Reflect.getMetadata(DatabaseDefinitionMetadataKey, target);
}

export abstract class DatabaseTable {

    constructor(protected db: Database, protected tableName: string) {
        db.exec(this.getTableDefinition())
            .then(
            () => {
                Log.write(this.tableName + " db module initialized successfully.");
            },
            error => {
                Log.write("Failed to init " + this.tableName + " db module:", error);
            }
            );
    }

    private getTableDefinition(): string {
        var fields = this.getTableFields();
        var fieldsString = '';
        var keys = Object.keys(fields);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            fieldsString += fieldsString !== '' ? ', ': '';
            fieldsString += `"${key}" ${fields[key].type}${fields[key].typeExtension ? " " + fields[key].typeExtension : ""}`;
        }

        var query = `
        CREATE TABLE IF NOT EXISTS "main"."${this.tableName}" 
            (${fieldsString})
        `;

        return query;
    }

    protected getTableFields(): IDatabaseFieldsDefinition {
        var result: IDatabaseFieldsDefinition = {};
        this.getTableFieldsRecursively((this as any).__proto__, result);
        return result;
    }

    private getTableFieldsRecursively(proto: any, fields: IDatabaseFieldsDefinition) {
        if (proto.__proto__) this.getTableFieldsRecursively(proto.__proto__, fields);
        var def = getDatabaseDefinition(proto.constructor);
        if (def) {
            var keys = Object.keys(def);
            for(var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if(fields[key]) throw new Error('Duplicate database field name definition in inheritance hierarchy!'); 
                else {
                   fields[key] = def[key]; 
                }
            }
        }
    }
}