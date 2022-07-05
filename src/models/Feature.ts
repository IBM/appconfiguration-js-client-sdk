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
import Metering from '../utils/metering';
import { getCacheInstance } from './Cache';
import FeatureSegmentRule, { IFeatureSegmentRule } from './FeatureSegmentRule';

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
    public getCurrentValue(entityId: string, entityAttributes: { [x: string]: any; }): any {
        if (!entityId) {
            console.log(''.concat(Constants.APP_CONFIGURATION, 'Feature flag evaluation: ', Constants.INVALID_ENTITY_ID, ' getCurrentValue'));
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
                if (this.rollout_percentage === 100 || (getNormalizedValue(''.concat(entityId, ':', this.feature_id)) < this.rollout_percentage)) {
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
                                // check whether the entityAttributes satifies all the rules of that segment
                                if (this.evaluateSegment(segmentId, entityAttributes)) {
                                    resultDict.evaluated_segment_id = segmentId;
                                    const segmentLevelRolloutPercentage = segmentRule.rollout_percentage === Constants.DEFAULT_ROLLOUT_PERCENTAGE ? this.rollout_percentage : segmentRule.rollout_percentage as number;
                                    // check whether the entityId is eligible for segment rollout
                                    if (segmentLevelRolloutPercentage === 100 || (getNormalizedValue(''.concat(entityId, ':', this.feature_id)) < segmentLevelRolloutPercentage)) {
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
        if (this.rollout_percentage === 100 || (getNormalizedValue(''.concat(entityId, ':', this.feature_id)) < this.rollout_percentage)) {
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
