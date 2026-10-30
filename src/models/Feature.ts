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
import { getNormalizedValue } from '../utils/hashing';
import Analytics from '../utils/analytics';
import { EventType, AnalyticsMetric } from '../utils/analyticsrecord';
import Metering from '../utils/metering';
import { getCacheInstance } from './Cache';
import FeatureSegmentRule, { IFeatureSegmentRule } from './FeatureSegmentRule';
import { logger } from '../utils/logger';
import { RolloutConfiguration, getCurrentRolloutPercentage } from '../utils/rollout';
import { PROGRESSIVE } from "../utils/constants";

export interface IFeature {
    name: string;
    feature_id: string;
    type: string;
    format?: string;
    enabled_value: any;
    disabled_value: any;
    segment_rules: IFeatureSegmentRule[];
    enabled: boolean;
    rollout_percentage?: number;
    rollout_type?: string;
    rollout_id?: string | null;
    metrics?: IFeatureMetric[];
    metric_map?: { [eventKey: string]: IFeatureMetric[] };
    rollout_configuration?: RolloutConfiguration;
}

export interface IFeatureMetric {
    id: string;
    type: string;
    event_key?: string;
}

interface EvaluationResult {
    evaluated_segment_id: string;
    value: any;
    is_enabled: boolean;
}

export default class Feature {
    private name: string;

    private feature_id: string;

    private type: string;

    private format: string | undefined;

    private enabled_value: any;

    private disabled_value: any;

    private segment_rules: IFeatureSegmentRule[];

    private enabled: boolean;

    private rollout_percentage: number;

    private rollout_id: string | null;

    private metric_map: { [eventKey: string]: IFeatureMetric[] };

    private rollout_type: string;

    private rollout_configuration: RolloutConfiguration | undefined;

    constructor({
        name,
        feature_id,
        type,
        format = undefined,
        enabled_value,
        disabled_value,
        segment_rules,
        enabled,
        rollout_percentage = 100,
        rollout_type = Constants.MANUAL,
        rollout_id = null,
        metrics = [],
        metric_map = undefined,
        rollout_configuration = undefined,
    }: IFeature) {
        this.name = name;
        this.feature_id = feature_id;
        this.type = type;
        this.format = format; // will be undefined for boolean & numeric datatypes
        this.enabled_value = enabled_value;
        this.disabled_value = disabled_value;
        this.enabled = enabled;
        this.rollout_percentage = rollout_percentage;
        this.segment_rules = [];
        for (const element of segment_rules) this.segment_rules.push(new FeatureSegmentRule(element));
        this.rollout_type = rollout_type;
        this.rollout_id = rollout_id;
        this.metric_map = metric_map || metrics.reduce((map: { [eventKey: string]: IFeatureMetric[] }, metric) => {
            if (metric.event_key) {
                map[metric.event_key] = map[metric.event_key] || [];
                map[metric.event_key].push({ id: metric.id, type: metric.type });
            }
            return map;
        }, {});
        this.rollout_configuration = rollout_configuration;
    }

    /**
     * Get the Feature flag name.
     *
     * @return {*}  {string} The Feature flag name.
     * @memberof Feature
     */
    public getFeatureName(): string {
        return this.name;
    }

    /**
     * Get the Feature flag Id.
     *
     * @return {*}  {string} The Feature flag Id.
     * @memberof Feature
     */
    public getFeatureId(): string {
        return this.feature_id;
    }

    /**
     * Get the Feature flag data type.
     *
     * @return {*}  {string} string named BOOLEAN/STRING/NUMERIC.
     * @memberof Feature
     */
    public getFeatureDataType(): string {
        return this.type;
    }

    /**
     * Get the Feature flag data format.
     * Applicable only for STRING datatype feature flag.
     * 
     * @return {*}  {(string | undefined)} string named TEXT/JSON/YAML.
     * @memberof Feature
     */
    public getFeatureDataFormat(): string | undefined {
        // Format will be `undefined` for Boolean & Numeric feature flags
        // If the Format is null or undefined for a String type, we default it to TEXT
        if (!this.format && this.type === 'STRING') {
            this.format = 'TEXT';
        }
        return this.format;
    }

    /**
     * Returns the state of the feature flag.
     *
     * @return {*}  {boolean} Returns true, if the feature flag is enabled, otherwise returns false.
     * @memberof Feature
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    public getRolloutId(): string {
        return this.rollout_id || '';
    }

    public getMetricMap(): { [eventKey: string]: IFeatureMetric[] } {
        return this.metric_map;
    }

    public track(eventKey: string, entityId: string): void {
        if (typeof entityId !== 'string' || entityId.trim() === '') {
            logger.warning('track: entityId must be a non-empty string');
            return;
        }
        if (typeof eventKey !== 'string' || eventKey.trim() === '') {
            logger.warning('track: eventKey must be a non-empty string');
            return;
        }

        // Resolve metric map: check segment-rule metric_maps first, then fall back to feature-level.
        let resolvedMetricMap: { [eventKey: string]: IFeatureMetric[] } | undefined;
        for (const rule of this.segment_rules) {
            const segRule = new FeatureSegmentRule(rule);
            if (segRule.metric_map && Object.prototype.hasOwnProperty.call(segRule.metric_map, eventKey)) {
                resolvedMetricMap = segRule.metric_map as { [eventKey: string]: IFeatureMetric[] };
                break;
            }
        }
        if (resolvedMetricMap === undefined) {
            resolvedMetricMap = this.metric_map;
        }

        if (!resolvedMetricMap || !Object.prototype.hasOwnProperty.call(resolvedMetricMap, eventKey)) {
            logger.warning(`The event key:${eventKey} was not found in this feature and its segment rules:${this.feature_id}`);
            return;
        }
        const metrics = resolvedMetricMap[eventKey];
        let rolloutId: string | null = null;
        let percentage = 0;
        const guardedRule = this.segment_rules.find((rule) => rule.rollout_type === Constants.GUARDED);
        if (this.rollout_type === Constants.GUARDED) {
            rolloutId = this.rollout_id;
            percentage = this.rollout_percentage;
        } else if (guardedRule) {
            rolloutId = guardedRule.rollout_id || null;
            percentage = guardedRule.rollout_percentage === Constants.DEFAULT_ROLLOUT_PERCENTAGE
                ? this.rollout_percentage : Number(guardedRule.rollout_percentage);
        }
        if (!rolloutId) {
            logger.warning('This feature or any of its segment rules is not configured for guarded rollout');
            return;
        }
        const normalized = getNormalizedValue([entityId, this.feature_id, rolloutId].join(':'));
        const valueServed = normalized < percentage ? 'target' : normalized < 2 * percentage ? 'original' : null;
        if (valueServed) {
            const metric: AnalyticsMetric = { rollout_id: rolloutId, entity_id: entityId, event_key: eventKey, metrics, value_served: valueServed };
            Analytics.getInstance().addMetric(metric, EventType.GUARDED_METRIC);
        }
    }

    private addGuardedEvaluation(rolloutId: string | null, entityId: string, percentage: number, normalized: number): void {
        if (!rolloutId) return;
        const valueServed = normalized < percentage ? 'target' : normalized < 2 * percentage ? 'original' : null;
        if (valueServed) {
            Analytics.getInstance().addMetric({ rollout_id: rolloutId, entity_id: entityId, value_served: valueServed }, EventType.GUARDED_EVALUATION);
        }
    }

    private getNormalizedForFeature(entityId: string): number {
        let suffix = '';
        if (this.rollout_configuration || this.rollout_type === Constants.PROGRESSIVE) {
            suffix = this.rollout_configuration?.start_at || '';
        } else if (this.rollout_type === Constants.GUARDED) {
            suffix = this.rollout_id || '';
        }
        const key = [entityId, this.feature_id, suffix].filter((value) => value !== '').join(':');
        return getNormalizedValue(key);
    }

    private getNormalizedForRule(rule: FeatureSegmentRule, entityId: string): number {
        let suffix = '';
        if (rule.getRolloutConfiguration() || rule.getRolloutType() === Constants.PROGRESSIVE) {
            suffix = rule.getRolloutConfiguration()?.start_at || this.rollout_configuration?.start_at || '';
        } else if (rule.getRolloutType() === Constants.GUARDED) {
            suffix = rule.getRolloutId();
        }
        const key = [entityId, this.feature_id, suffix].filter((value) => value !== '').join(':');
        return getNormalizedValue(key);
    }

    /**
     * Get the evaluated value of the feature flag.
     *
     * @param {string} entityId - Id of the Entity.
     * This will be a string identifier related to the Entity against which the feature is evaluated.
     * For example, an entity might be an instance of an app that runs on a mobile device, a microservice that runs on the cloud, or a component of infrastructure that runs that microservice.
     * For any entity to interact with App Configuration, it must provide a unique entity ID.
     * 
     * @param {{ [x: string]: any; }} entityAttributes - A JSON object consisting of the attribute name and their values that defines the specified entity.
     * This is an optional parameter if the feature flag is not configured with any targeting definition. If the targeting is configured, then entityAttributes should be provided for the rule evaluation.
     * An attribute is a parameter that is used to define a segment. The SDK uses the attribute values to determine if the
     * specified entity satisfies the targeting rules, and returns the appropriate feature flag value.
     * 
     * @return {*}  {*} Returns one of the Enabled/Disabled/Overridden value based on the evaluation.
     * The data type of returned value matches that of feature flag.
     * @memberof Feature
     */
    public getCurrentValue(entityId: string, entityAttributes: { [x: string]: any; } = {}): any {
        if (!entityId) {
            logger.warning(''.concat('Feature flag evaluation: ', Constants.INVALID_ENTITY_ID, ' getCurrentValue'));
            return null;
        }

        return this.featureEvaluation(entityId, entityAttributes).current_value;
    }

    private featureEvaluation(entityId: string, entityAttributes: { [x: string]: any; }) {
        let evaluationResult: EvaluationResult = {
            evaluated_segment_id: Constants.DEFAULT_SEGMENT_ID,
            value: undefined,
            is_enabled: false
        };
        try {
            // evaluate the feature flag only if the toggle state is enabled
            if (this.enabled) {
                // check whether the feature flag is configured with any targeting definition and then check whether the user has passed an valid entityAttributes JSON before we evaluate
                if (this.segment_rules.length > 0 && Object.keys(entityAttributes).length > 0) {
                    const rulesMap = this.parseRules(this.segment_rules);
                    evaluationResult = this.evaluateRules(rulesMap, entityId, entityAttributes);
                    return { current_value: evaluationResult.value, is_enabled: evaluationResult.is_enabled };
                }
                // since the feature flag is not configured with any targeting, use the entityId and check whether the entityId is eligible for the default rollout
                let rolloutPercentage;
                if (this.rollout_configuration || this.rollout_type === PROGRESSIVE) {
                    const rolloutMap = getCacheInstance().rolloutConfigMap[this.feature_id];
                    rolloutPercentage = rolloutMap ? getCurrentRolloutPercentage(rolloutMap) : 0;
                } else {
                    rolloutPercentage = this.rollout_percentage;
                }
                const normalized = this.getNormalizedForFeature(entityId);
                this.addGuardedEvaluation(this.rollout_type === Constants.GUARDED ? this.rollout_id : null, entityId, rolloutPercentage, normalized);
                if (rolloutPercentage === 100 || normalized < rolloutPercentage) {
                    return { current_value: this.enabled_value, is_enabled: true };
                }
                return { current_value: this.disabled_value, is_enabled: false };
            }
            return { current_value: this.disabled_value, is_enabled: false };
        } finally {
            Metering.getInstance().addMetering(entityId, evaluationResult.evaluated_segment_id, this.feature_id, null);
        }
    }

    private parseRules(segmentRules: IFeatureSegmentRule[]): { [x: number]: IFeatureSegmentRule } {
        const rulesMap: { [x: number]: IFeatureSegmentRule } = {}
        segmentRules.forEach((rules) => {
            rulesMap[rules.order] = rules;
        });
        return rulesMap;
    }

    private evaluateRules(rulesMap: { [x: number]: IFeatureSegmentRule }, entityId: string, entityAttributes: { [x: string]: any; }) {
        const resultDict: EvaluationResult = {
            evaluated_segment_id: Constants.DEFAULT_SEGMENT_ID,
            value: undefined,
            is_enabled: false
        };

        try {
            // for each rules in the targeting
            for (let index = 1; index <= Object.keys(rulesMap).length; index += 1) {
                const segmentRule = rulesMap[index];
                if (segmentRule.rules.length > 0) {
                    for (const level of segmentRule.rules) {
                        const { segments } = level;
                        if (segments.length > 0) {
                            // for each segment in a rule
                            for (const innerLevel of segments) {
                                const segmentId: string = innerLevel
                                // check whether the entityAttributes satisfies all the rules of that segment
                                if (this.evaluateSegment(segmentId, entityAttributes)) {
                                    resultDict.evaluated_segment_id = segmentId;
                                    let segmentLevelRolloutPercentage: number;
                                    const segmentRuleObj = new FeatureSegmentRule(segmentRule);
                                    if (segmentRuleObj.getRolloutConfiguration() !== undefined || segmentRuleObj.getRolloutType() === PROGRESSIVE) {
                                        // phased rollout
                                        let rolloutMap;
                                        if (segmentRule.rollout_percentage === Constants.DEFAULT_ROLLOUT_PERCENTAGE) {
                                            // Use feature-level rollout configuration
                                            rolloutMap = getCacheInstance().rolloutConfigMap[this.feature_id];
                                        } else {
                                            // Use segment-level rollout configuration
                                            const key = this.feature_id + Constants.DELIMITER + segmentRuleObj.getRuleId()?.toString();
                                            rolloutMap = getCacheInstance().rolloutConfigMap[key];
                                        }
                                        if (rolloutMap) {
                                            segmentLevelRolloutPercentage = getCurrentRolloutPercentage(rolloutMap);
                                        } else {
                                            segmentLevelRolloutPercentage = 0;
                                        }
                                    } else {
                                        // manual rollout
                                        segmentLevelRolloutPercentage = segmentRule.rollout_percentage === Constants.DEFAULT_ROLLOUT_PERCENTAGE ? this.rollout_percentage : segmentRule.rollout_percentage as number;
                                    }
                                    // check whether the entityId is eligible for segment rollout
                                    const normalized = this.getNormalizedForRule(segmentRuleObj, entityId);
                                    this.addGuardedEvaluation(segmentRuleObj.getRolloutType() === Constants.GUARDED ? segmentRuleObj.getRolloutId() : null, entityId, Number(segmentLevelRolloutPercentage), normalized);
                                    if (segmentLevelRolloutPercentage === 100 || normalized < segmentLevelRolloutPercentage) {
                                        // since the entityId is eligible for segment rollout the return value should be either of inherited or overridden value
                                        if (segmentRule.value === Constants.DEFAULT_FEATURE_VALUE) {
                                            resultDict.value = this.enabled_value; // return the inherited value
                                        } else {
                                            resultDict.value = segmentRule.value; // return the overridden value
                                        }
                                        resultDict.is_enabled = true;
                                    } else {
                                        resultDict.value = this.disabled_value;
                                        resultDict.is_enabled = false;
                                    }
                                    return resultDict;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: unknown) {
            console.error(''.concat(Constants.APP_CONFIGURATION, 'FeatureFlagRuleEvaluation', (e as Error).message));
        }

        // since entityAttributes did not satisfy any of the targeting rules
        // check whether the entityId is eligible for default rollout
        let rolloutPercentage;
        if (this.rollout_configuration || this.rollout_type === PROGRESSIVE) {
            const rolloutMap = getCacheInstance().rolloutConfigMap[this.feature_id];
            rolloutPercentage = rolloutMap ? getCurrentRolloutPercentage(rolloutMap) : 0;
        } else {
            rolloutPercentage = this.rollout_percentage;
        }
        const normalized = this.getNormalizedForFeature(entityId);
        this.addGuardedEvaluation(this.rollout_type === Constants.GUARDED ? this.rollout_id : null, entityId, rolloutPercentage, normalized);
        if (rolloutPercentage === 100 || normalized < rolloutPercentage) {
            resultDict.value = this.enabled_value;
            resultDict.is_enabled = true;
        } else {
            resultDict.value = this.disabled_value;
            resultDict.is_enabled = false;
        }
        return resultDict;
    }

    private evaluateSegment(segmentId: string, entityAttributes: { [x: string]: any; }): boolean {
        const segment = getCacheInstance().segments;
        if (Object.prototype.hasOwnProperty.call(segment, segmentId)) {
            return segment[segmentId].evaluateRule(entityAttributes);
        }
        return false;
    }
}
