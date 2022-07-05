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

interface IRule {
    segments: string[];
}

export interface IFeatureSegmentRule {
    rules: IRule[];
    value: any;
    order: number;
    rollout_percentage?: number | string;
}

export default class FeatureSegmentRule {
    rules: IRule[];

    value: any;

    order: number;

    rollout_percentage: number | string;

    constructor({
        rules,
        value,
        order,
        rollout_percentage = 100,
    }: IFeatureSegmentRule) {
        this.rules = rules;
        this.value = value;
        this.order = order;
        this.rollout_percentage = rollout_percentage
    }

    public getRules(): IRule[] {
        return this.rules;
    }

    public getValue(): any {
        return this.value;
    }

    public getOrder(): number {
        return this.order;
    }

    public getRolloutPercentage(): number | string {
        return this.rollout_percentage;
    }
}
