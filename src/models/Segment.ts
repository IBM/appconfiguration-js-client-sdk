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

import Rule, { IRule } from './Rule';

export interface ISegment {
    name: string;
    segment_id: string;
    rules: IRule[];
}

export default class Segment {
    private name: string;

    private segment_id: string;

    private rules: IRule[];

    constructor({
        name,
        segment_id,
        rules
    }: ISegment) {
        this.name = name;
        this.segment_id = segment_id;
        this.rules = rules;
    }

    public evaluateRule(entityAttributes: { [x: string]: any; }): boolean {
        for (const i of this.rules) {
            const rule = i;

            const ruleObj = new Rule(rule);
            if (!ruleObj.evaluateRule(entityAttributes)) {
                return false;
            }
        }
        return true;
    }
}
