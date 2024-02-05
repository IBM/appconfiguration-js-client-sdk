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
import Metering from '../utils/metering';
import { getCacheInstance } from './Cache';
import PropertySegmentRule, { IPropertySegmentRule } from './PropertySegmentRule';
import { Logger } from '../utils/logger';

const logger = new Logger(Constants.APP_CONFIGURATION);

export interface IProperty {
    name: string;
    property_id: string;
    type: string;
    format?: string;
    value: any;
    segment_rules: IPropertySegmentRule[];
}

interface EvaluationResult {
    evaluated_segment_id: string;
    value: any;
}

export default class Property {
    private name: string;

    private property_id: string;

    private type: string;

    private format: string | undefined;

    private value: any;

    private segment_rules: IPropertySegmentRule[];

    constructor({
        name,
        property_id,
        type,
        format = undefined,
        value,
        segment_rules,
    }: IProperty) {
        this.name = name;
        this.property_id = property_id;
        this.type = type;
        this.format = format; // will be undefined for boolean & numeric datatypes
        this.value = value;
        this.segment_rules = [];
        for (const element of segment_rules) this.segment_rules.push(new PropertySegmentRule(element));
    }

    /**
     * Get the Property name.
     *
     * @return {*}  {string} The Property name.
     * @memberof Property
     */
    public getPropertyName(): string {
        return this.name;
    }

    /**
     * Get the Property id.
     *
     * @return {*}  {string} The Property Id.
     * @memberof Property
     */
    public getPropertyId(): string {
        return this.property_id;
    }

    /**
     * Get the Property data type.
     *
     * @return {*}  {string} string named BOOLEAN/STRING/NUMERIC.
     * @memberof Property
     */
    public getPropertyDataType(): string {
        return this.type;
    }

    /**
     * Get the Property data format.
     * Applicable only for STRING datatype property.
     * 
     * @return {*}  {(string | undefined)} string named TEXT/JSON/YAML.
     * @memberof Property
     */
    public getPropertyDataFormat(): string | undefined {
        // Format will be `undefined` for Boolean & Numeric properties
        // If the Format is null or undefined for a String type, we default it to TEXT
        if (!(this.format) && this.type === 'STRING') {
            this.format = 'TEXT';
        }
        return this.format;
    }

    /**
     * Get the evaluated value of the property.
     *
     * @param {string} entityId - Id of the Entity.
     * This will be a string identifier related to the Entity against which the property is evaluated.
     * For example, an entity might be an instance of an app that runs on a mobile device, a microservice that runs on the cloud, or a component of infrastructure that runs that microservice.
     * For any entity to interact with App Configuration, it must provide a unique entity ID.
     * 
     * @param {{ [x: string]: any; }} entityAttributes - A JSON object consisting of the attribute name and their values that defines the specified entity.
     * This is an optional parameter if the property is not configured with any targeting definition. If the targeting is configured, then entityAttributes should be provided for the rule evaluation.
     * An attribute is a parameter that is used to define a segment. The SDK uses the attribute values to determine if the
     * specified entity satisfies the targeting rules, and returns the appropriate property value.
     * 
     * @return {*}  {*} Returns the default property value or its overridden value based on the evaluation.
     * The data type of returned value matches that of property.
     * @memberof Property
     */
    public getCurrentValue(entityId: string, entityAttributes: { [x: string]: any; } = {}): any {
        if (!entityId) {
            logger.log(''.concat('Property evaluation: ', Constants.INVALID_ENTITY_ID, ' getCurrentValue'));
            return null;
        }

        return this.propertyEvaluation(entityId, entityAttributes);
    }

    private propertyEvaluation(entityId: string, entityAttributes: { [x: string]: any; }) {
        let evaluationResult: EvaluationResult = {
            evaluated_segment_id: Constants.DEFAULT_SEGMENT_ID,
            value: null,
        };
        try {
            // check whether the property is configured with any targeting definition and then check whether the user has passed an valid entityAttributes JSON before we evaluate
            if (this.segment_rules.length > 0 && Object.keys(entityAttributes).length > 0) {
                const rulesMap = this.parseRules(this.segment_rules);
                evaluationResult = this.evaluateRules(rulesMap, entityId, entityAttributes);
                return evaluationResult.value;
            }
            return this.value;
        } finally {
            Metering.getInstance().addMetering(entityId, evaluationResult.evaluated_segment_id, null, this.property_id);
        }
    }

    private parseRules(segmentRules: IPropertySegmentRule[]): { [x: number]: IPropertySegmentRule } {
        const rulesMap: { [x: number]: IPropertySegmentRule } = {}
        segmentRules.forEach((rules) => {
            rulesMap[rules.order] = rules;
        });
        return rulesMap;
    }

    private evaluateRules(rulesMap: { [x: number]: IPropertySegmentRule }, _entityId: string, entityAttributes: { [x: string]: any; }): EvaluationResult {
        const resultDict: EvaluationResult = {
            evaluated_segment_id: Constants.DEFAULT_SEGMENT_ID,
            value: null,
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
                                    resultDict.evaluated_segment_id = segmentId; {
                                        if (segmentRule.value === Constants.DEFAULT_PROPERTY_VALUE) {
                                            resultDict.value = this.value;
                                        } else {
                                            resultDict.value = segmentRule.value;
                                        }
                                    }
                                    return resultDict;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error(''.concat(Constants.APP_CONFIGURATION, 'PropertyRuleEvaluation', (e as Error).message));
        }
        resultDict.value = this.value;
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
