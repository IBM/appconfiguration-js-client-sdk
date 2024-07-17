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

import { getCacheInstance } from '../models/Cache';
import { retryablePostExpMetricEvents } from './apimanager';
import { APIError } from './custom-error';
import { logger } from './logger';

export interface MetricEvent {
    type: string;
    environment_id: string;
    usages: MetricUsage[];
}

export interface MetricUsage {
    experiment_id: string;
    iteration_id: string;
    feature_id: string;
    entity_id: string;
    event_key: string;
    timestamp?: string;
}

let usages: MetricUsage[] = []

export default class ExpMetricMetering {
    private static instance: ExpMetricMetering;

    private environmentId: string | undefined;

    private meteringInterval: number = 60 * 1000; // 1 minute

    private timer: any;

    private startMetering = false; // flag to start sendMetering() only after addMetering() is called. (i.e., when the first evaluation is added)

    private stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            delete this.timer;
        }
    }

    private constructor() { /* singleton design pattern */ }

    init(environmentId: string) {
        this.environmentId = environmentId;
    }

    addMetering(eventName: string, entityId: string) {
        if (!this.startMetering) {
            this.timer = setInterval(() => {
                this.sendMetering(false);
            }, this.meteringInterval);
            this.startMetering = true;
        }
        const { features } = getCacheInstance();
        for (const k in features) {
            if (features[k].experiment?.experiment_status === 'RUNNING') {
                const d: MetricUsage = {
                    experiment_id: features[k].experiment?.experiment_id as string,
                    iteration_id: features[k].experiment?.iteration.iteration_id as string,
                    feature_id: features[k].getFeatureId(),
                    entity_id: entityId,
                    event_key: eventName
                }
                const time = `${(new Date()).toISOString().split('.')[0]}Z`;
                d.timestamp = time;
                usages.push(d);
                break
            }

        }
    }

    private async sendToServer(data: MetricEvent, keepalive: boolean) {
        try {
            await retryablePostExpMetricEvents(data, keepalive);
        } catch (e) {
            if (e instanceof APIError) {
                if ((e.statusCode >= 500 && e.statusCode <= 599) || e.statusCode === 429) {
                    setTimeout(() => {
                        this.sendToServer(data, keepalive);
                    }, this.meteringInterval)
                } else {
                    logger.error('Unexpected error: ', e);
                }
            } else {
                logger.error('Unexpected error: ', e);
            }
        }
    }

    async sendMetering(keepalive: boolean) {
        try {
            const metricsUsages = usages;
            usages = [];
            if (metricsUsages.length === 0) {
                return;
            }
            const data: MetricEvent = {
                type: 'metric_event',
                environment_id: this.environmentId as string,
                usages: metricsUsages,
            }
            this.sendToServer(data, keepalive);
        } catch (e) {
            logger.error(e);
        }
    }

    public static getInstance() {
        if (!ExpMetricMetering.instance) {
            ExpMetricMetering.instance = new ExpMetricMetering();
        }
        return ExpMetricMetering.instance;
    }
}
