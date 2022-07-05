/**
 * Copyright 2022 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface IRule {
    attribute_name: string;
    operator: string;
    values: string[];
}

export default class Rule {
    private attribute_name: string;

    private operator: string;

    private values: string[];

    constructor({
        attribute_name,
        operator,
        values
    }: IRule) {
        this.attribute_name = attribute_name;
        this.operator = operator;
        this.values = values;
    }

    private operatorCheck(key: any, value: string): boolean {
        let result = false;
        if (key === undefined || key === null || value === '') {
            return result;
        }
        let reg;
        switch (this.operator) {
            case 'endsWith':
                reg = new RegExp(`${value}$`, 'i');
                result = reg.test(key);
                break;
            case 'startsWith':
                reg = new RegExp(`^${value}`, 'i');
                result = reg.test(key);
                break;
            case 'contains':
                result = key.includes(value);
                break;
            case 'is':
                if (typeof (key) === 'number') {
                    result = (key === parseFloat(value));
                } else {
                    result = (key.toString() === value.toString());
                }
                break;
            case 'greaterThan':
                result = (parseFloat(key) > parseFloat(value));
                break;
            case 'lesserThan':
                result = (parseFloat(key) < parseFloat(value));
                break;
            case 'greaterThanEquals':
                result = (parseFloat(key) >= parseFloat(value));
                break;
            case 'lesserThanEquals':
                result = (parseFloat(key) <= parseFloat(value));
                break;
            default:
                // unknown type
                result = false;
        }
        return result;
    }

    public evaluateRule(entityAttributes: { [x: string]: any; }) {
        let key;
        let result = false;

        if (Object.prototype.hasOwnProperty.call(entityAttributes, this.attribute_name)) {
            key = entityAttributes[this.attribute_name];
        } else {
            return result;
        }
        for (const i of this.values) {
            const value = i;
            if (this.operatorCheck(key, value)) {
                result = true;
            }
        }
        return result;
    }
}
