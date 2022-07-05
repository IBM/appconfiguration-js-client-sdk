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

import { retryablePostMetering } from './apimanager';
import * as Constants from './constants';
import { APIError } from './custom-error';

interface Usage {
    [key: string]: string | number | null;
}

export interface MeteringRequestBody {
    [key: string]: string | Usage[];
}

interface MeteringCommon {
    [entityId: string]: { [segmentId: string]: { count: number, evaluation_time: string } }
}

interface MeteringFeature {
    [featureId: string]: MeteringCommon,
}

interface MeteringProperty {
    [propertyId: string]: MeteringCommon,
}

export default class Metering {
    private static instance: Metering;

    private environmentId: string | undefined;

    private collectionId: string | undefined;

    private meteringInterval: number = 300 * 1000; // 5 minutes

    private timer: any;

    private startMetering = false; // flag to start sendMetering() only after addMetering() is called. (i.e., when the first evaluation is added)

    private meteringFeatureData: MeteringFeature = {};

    private meteringPropertyData: MeteringProperty = {};

    private stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            delete this.timer;
        }
    }

    private constructor() { /* singleton design pattern */ }

    init(collectionId: string, environmentId: string) {
        this.collectionId = collectionId;
        this.environmentId = environmentId;
    }

    addMetering(
        entityId: string,
        segmentId: string,
        featureId: string | null,
        propertyId: string | null) {

        if (!this.startMetering) {
            this.timer = setInterval(() => {
                this.sendMetering(false);
            }, this.meteringInterval);
            this.startMetering = true;
        }

        const meteringData: MeteringFeature | MeteringProperty = featureId !== null ? this.meteringFeatureData : this.meteringPropertyData;
        const modifyKey: string = (featureId !== null ? featureId : propertyId) as string;

        const time = `${(new Date()).toISOString().split('.')[0]}Z`;
        const metric = {
            count: 1,
            evaluation_time: time,
        };

        if (Object.prototype.hasOwnProperty.call(meteringData, modifyKey)) {
            if (Object.prototype.hasOwnProperty.call(meteringData[modifyKey], entityId)) {
                if (Object.prototype.hasOwnProperty.call(meteringData[modifyKey][entityId], segmentId)) {
                    meteringData[modifyKey][entityId][segmentId].evaluation_time = time;
                    meteringData[modifyKey][entityId][segmentId].count += 1;
                }
            } else {
                meteringData[modifyKey][entityId] = {};
                meteringData[modifyKey][entityId][segmentId] = metric;
            }
        } else {
            meteringData[modifyKey] = {};
            meteringData[modifyKey][entityId] = {};
            meteringData[modifyKey][entityId][segmentId] = metric;
        }
    }

    private buildRequestBody(sendMeteringData: MeteringFeature | MeteringProperty, result: MeteringRequestBody[], key: string) {

        const body: MeteringRequestBody = {};
        const usages: Usage[] = [];
        const data = sendMeteringData;
        Object.keys(data).forEach((featureId) => {
            Object.keys(data[featureId]).forEach((entityId) => {
                Object.keys(data[featureId][entityId]).forEach((segmentId) => {
                    const usage: Usage = {
                        [key]: featureId,
                        'entity_id': entityId === Constants.DEFAULT_ENTITY_ID ? null : entityId,
                        'segment_id': segmentId === Constants.DEFAULT_SEGMENT_ID ? null : segmentId,
                        'evaluation_time': data[featureId][entityId][segmentId].evaluation_time,
                        'count': data[featureId][entityId][segmentId].count,
                    };
                    usages.push(usage);
                    body.collection_id = this.collectionId as string;
                    body.environment_id = this.environmentId as string;
                    body.usages = usages
                });
            });
        });
        result.push(body);
    }

    private async sendToServer(data: MeteringRequestBody, keepalive: boolean) {

        try {
            await retryablePostMetering(data, keepalive);
        } catch (e) {
            if (e instanceof APIError) {
                if ((e.statusCode >= 500 && e.statusCode <= 599) || e.statusCode === 429) {
                    setTimeout(() => {
                        this.sendToServer(data, keepalive);
                    }, this.meteringInterval)
                } else {
                    console.error('Unexpected error: ', e);
                }
            } else {
                console.error('Unexpected error: ', e);
            }
        }
    }

    private sendSplitMetering(data: MeteringRequestBody, count: number, keepalive: boolean) {
        let lim = 0;

        const subUsagesArray = data.usages as Usage[];

        while (lim < count) {
            const endIndex = lim + Constants.DEFAULT_USAGE_LIMIT >= count ? count : lim + Constants.DEFAULT_USAGE_LIMIT;
            const body: MeteringRequestBody = {};
            const usages: Usage[] = [];
            for (let i = lim; i < endIndex; i += 1) {
                usages.push(subUsagesArray[i]);
            }
            body.collection_id = data.collection_id
            body.environment_id = data.environment_id
            body.usages = usages
            this.sendToServer(body, keepalive);
            lim += Constants.DEFAULT_USAGE_LIMIT;
        }
    }

    async sendMetering(keepalive: boolean) {
        try {
            const sendFeatureData = this.meteringFeatureData;
            const sendPropertyData = this.meteringPropertyData;
            this.meteringFeatureData = {};
            this.meteringPropertyData = {};

            if ((Object.keys(sendFeatureData).length) <= 0 && (Object.keys(sendPropertyData).length <= 0)) {
                return;
            }

            const result: MeteringRequestBody[] = [];

            if (Object.keys(sendFeatureData).length > 0) {
                this.buildRequestBody(sendFeatureData, result, 'feature_id');
            }

            if (Object.keys(sendPropertyData).length > 0) {
                this.buildRequestBody(sendPropertyData, result, 'property_id');
            }

            result.forEach((data) => {
                const count = data.usages.length;
                if (count > Constants.DEFAULT_USAGE_LIMIT) {
                    this.sendSplitMetering(data, count, keepalive);
                } else {
                    this.sendToServer(data, keepalive);
                }
            });
        } catch (e) {
            console.error(e);
        }

    }

    public static getInstance() {
        if (!Metering.instance) {
            Metering.instance = new Metering();
        }
        return Metering.instance;
    }
}
