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

import { retryablePostExpEvaluationEvents } from './apimanager';
import { APIError } from './custom-error';
import { logger } from './logger';

export interface EvaluationEvent {
    type: string;
    environment_id: string;
    usages: EvaluationUsage[];
}

export interface EvaluationUsage {
    experiment_id: string;
    iteration_id: string;
    feature_id: string;
    variation_id: string;
    entity_id: string;
    audience_group: string;
    timestamp?: string;
}

let usages: EvaluationUsage[] = []

export default class ExpEvalMetering {
    private static instance: ExpEvalMetering;

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

    addMetering(usage: EvaluationUsage) {
        if (!this.startMetering) {
            this.timer = setInterval(() => {
                this.sendMetering(false);
            }, this.meteringInterval);
            this.startMetering = true;
        }
        const time = `${(new Date()).toISOString().split('.')[0]}Z`;
        usage.timestamp = time;
        usages.push(usage);
    }

    private async sendToServer(data: EvaluationEvent, keepalive: boolean) {
        try {
            await retryablePostExpEvaluationEvents(data, keepalive);
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
            const eventsUsages = usages;
            usages = [];
            if (eventsUsages.length === 0) {
                return;
            }
            const data: EvaluationEvent = {
                type: 'evaluation_event',
                environment_id: this.environmentId as string,
                usages: eventsUsages,
            }
            this.sendToServer(data, keepalive);
        } catch (e) {
            logger.error(e);
        }
    }

    public static getInstance() {
        if (!ExpEvalMetering.instance) {
            ExpEvalMetering.instance = new ExpEvalMetering();
        }
        return ExpEvalMetering.instance;
    }
}
