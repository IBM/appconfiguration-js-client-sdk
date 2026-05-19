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

import { version } from '../../package.json';
import { EventSourcePolyfillInit } from '../polyfill/eventsource';
import * as Constants from './constants';

interface UrlBuilderOptions {
    region: string;
    guid: string;
    apikey: string;
    collectionId: string;
    environmentId: string;
    overrideServiceUrl: string;
    isRestrictedNetwork: boolean;
}

export default class UrlBuilder {
    private static instance: UrlBuilder;

    private region: string | undefined;

    private guid: string | undefined;

    private apikey: string | undefined;

    private collectionId: string | undefined;

    private environmentId: string | undefined;

    private overrideServiceUrl: string | undefined;

    private isRestrictedNetwork: boolean = false;

    private constructor() { /* singleton design pattern */ }

    init(options: UrlBuilderOptions) {
        this.region = options.region;
        this.guid = options.guid;
        this.apikey = options.apikey;
        this.collectionId = options.collectionId;
        this.environmentId = options.environmentId;
        this.overrideServiceUrl = options.overrideServiceUrl;
        this.isRestrictedNetwork = options.isRestrictedNetwork;
    }

    getAPICallHeaders(isPost = false) {
        const headers = new Headers();
        headers.append('Authorization', this.apikey as string)
        headers.append('User-Agent', ''.concat('appconfiguration-js-client-sdk/v', version, ' (', navigator.userAgent, ')'))
        if (isPost) {
            headers.append('Content-Type', 'application/json')
        }
        return headers;
    }

    getEventSourceHeaders(): EventSourcePolyfillInit {
        return {
            headers: {
                'Authorization': this.apikey as string,
                'User-Agent': ''.concat('appconfiguration-js-client-sdk/v', version, ' (', navigator.userAgent, ')')
            },
            heartbeatTimeout: Constants.EVENT_SOURCE_HEARTBEAT_TIMEOUT
        }
    }

    getBaseServiceUrl(): string {
        if (this.overrideServiceUrl) {
            return this.overrideServiceUrl;
        }
        return ''.concat('https://', this.region as string, '.apprapp.cloud.ibm.com');
    }

    getConfigUrl(): string {
        return ''.concat(this.getBaseServiceUrl(), '/apprapp/feature/v1/instances/', this.guid as string, '/config',
            '?action=sdkConfig&collection_id=' + this.collectionId as string, '&environment_id=', this.environmentId as string);
    }

    getMeteringUrl(): string {
        return ''.concat(this.getBaseServiceUrl(), '/apprapp/events/v1/instances/', this.guid as string, '/usage');
    }

    getExperimentAnalyticsUrl(): string {
        return ''.concat(this.getBaseServiceUrl(), '/apprapp/metrics/v1/instances/', this.guid as string, '/analytics');
    }

    getEventSourceUrl(): string {
        const url = ''.concat(this.getBaseServiceUrl(), '/apprapp/feature/v1/instances/', this.guid as string,
            '/environments/', this.environmentId as string, '/sse/subscribe?collection_id=', this.collectionId as string);
        if (this.isRestrictedNetwork) {
            return url + '&events_only=true';
        }
        return url;
    }

    public static getInstance() {
        if (!UrlBuilder.instance) {
            UrlBuilder.instance = new UrlBuilder();
        }
        return UrlBuilder.instance;
    }
}
