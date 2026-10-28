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

import * as Constants from '../utils/constants';
import { RolloutConfiguration } from '../utils/rollout';

interface IRule {
    segments: string[];
}

export interface IFeatureSegmentRuleMetric {
    id: string;
    type: string;
    event_key?: string;
}

export interface IFeatureSegmentRule {
    rules: IRule[];
    value: any;
    order: number;
    rollout_percentage?: number | string;
    rule_id?: string;
    rollout_id?: string | null;
    rollout_type?: string;
    rollout_configuration?: RolloutConfiguration;
    metrics?: IFeatureSegmentRuleMetric[];
    metric_map?: { [eventKey: string]: IFeatureSegmentRuleMetric[] };
}

export default class FeatureSegmentRule {
    rules: IRule[];

    value: any;

    order: number;

    rollout_percentage: number | string;

    rule_id: string | undefined;

    rollout_id: string | null;

    rollout_type: string;

    rollout_configuration: RolloutConfiguration | undefined;

    metric_map: { [eventKey: string]: IFeatureSegmentRuleMetric[] } | undefined;

    constructor({
        rules,
        value,
        order,
        rollout_percentage = 100,
        rule_id = undefined,
        rollout_id = null,
        rollout_type = Constants.MANUAL,
        rollout_configuration = undefined,
        metrics = undefined,
        metric_map = undefined,
    }: IFeatureSegmentRule) {
        this.rules = rules;
        this.value = value;
        this.order = order;
        this.rollout_percentage = rollout_percentage;
        this.rule_id = rule_id;
        this.rollout_id = rollout_id;
        this.rollout_type = rollout_type;
        this.rollout_configuration = rollout_configuration;
        this.metric_map = metric_map ?? (metrics
            ? metrics.reduce((map: { [eventKey: string]: IFeatureSegmentRuleMetric[] }, metric) => {
                if (metric.event_key) {
                    map[metric.event_key] = map[metric.event_key] || [];
                    map[metric.event_key].push({ id: metric.id, type: metric.type });
                }
                return map;
            }, {})
            : undefined);
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

    public getRuleId(): string | undefined {
        return this.rule_id;
    }

    public getRolloutId(): string {
        return this.rollout_id || '';
    }

    public getRolloutType(): string {
        return this.rollout_type || Constants.MANUAL;
    }

    public getRolloutConfiguration(): RolloutConfiguration | undefined {
        return this.rollout_configuration;
    }
}
