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

import { getCacheInstance, setCache } from './models/Cache';
import { ConfigResponse, instanceOfConfigResponse } from './models/ConfigResponse';
import Feature from './models/Feature';
import Property from './models/Property';
import Segment from './models/Segment';
import { EventSourcePolyfill } from './polyfill/eventsource';
import { retryableGetConfig } from './utils/apimanager';
import * as Constants from './utils/constants';
import { APIError } from './utils/custom-error';
import Emitter from './utils/events-handler';
import Metering from './utils/metering';
import { storage } from './utils/storage';
import UrlBuilder from './utils/urlbuilder';

const urlBuilder = UrlBuilder.getInstance();
const metering = Metering.getInstance();

export default class ConfigurationHandler {
    private static instance: ConfigurationHandler;

    private constructor() { /* singleton design pattern */ }

    private region: string | undefined;

    private guid: string | undefined;

    private apikey: string | undefined;

    private collectionId: string | undefined;

    private environmentId: string | undefined;

    private overrideServiceUrl: string | undefined;

    init(region: string, guid: string, apikey: string, overrideServiceUrl: string) {
        this.region = region;
        this.guid = guid;
        this.apikey = apikey;
        this.overrideServiceUrl = overrideServiceUrl;
    }

    async setContext(collectionId: string, environmentId: string): Promise<void> {
        this.collectionId = collectionId;
        this.environmentId = environmentId;
        urlBuilder.init({
            region: this.region as string,
            guid: this.guid as string,
            apikey: this.apikey as string,
            overrideServiceUrl: this.overrideServiceUrl as string,
            collectionId,
            environmentId,
        })
        metering.init(collectionId, environmentId);
        await this.fetchConfigurations();
    }

    async fetchConfigurations(): Promise<void> {
        const cacheConfig = storage.get('configdata');
        try {
            // load the configurations if exists in the localstorage. But do not emit configuration update event
            if (cacheConfig && instanceOfConfigResponse(cacheConfig)) {
                this.saveInCache(cacheConfig);
            }

            const response: ConfigResponse = await retryableGetConfig();
            storage.save('configdata', response);
            this.saveInCache(response);
            Emitter.emit(Constants.CONFIGURATION_UPDATE_EVENT);
        } catch (e) {
            if (e instanceof APIError) {
                console.error(''.concat(Constants.APP_CONFIGURATION, e.statusCode.toString(), ' ', e.message));
            } else {
                console.error(''.concat(Constants.APP_CONFIGURATION, 'Unexpected error: '), e);
            }
            // emit error event?
        }
        this.connectEventSource();
    }

    saveInCache(data: ConfigResponse) {

        const _featureMap: { [x: string]: Feature } = {};
        if (Object.keys(data.features).length) {
            const { features } = data;
            features.forEach((feature) => {
                _featureMap[feature.feature_id] = new Feature(feature);
            });
        }

        const _propertyMap: { [x: string]: Property } = {};
        if (Object.keys(data.properties).length) {
            const { properties } = data;
            properties.forEach((property) => {
                _propertyMap[property.property_id] = new Property(property);
            });
        }

        const _segmentMap: { [x: string]: Segment } = {};
        if (Object.keys(data.segments).length) {
            const { segments } = data;
            segments.forEach((segment) => {
                _segmentMap[segment.segment_id] = new Segment(segment);
            });
        }
        setCache(_featureMap, _propertyMap, _segmentMap);
    }

    connectEventSource() {
        const url = urlBuilder.getEventSourceUrl();
        const headers = urlBuilder.getEventSourceHeaders();
        const source = new EventSourcePolyfill(url, headers);

        source.addEventListener('error', () => { });

        source.addEventListener('Registration', () => { });

        source.addEventListener('SSEEvent_update', async () => {
            try {
                const response: ConfigResponse = await retryableGetConfig();
                storage.save('configdata', response)
                this.saveInCache(response);
                Emitter.emit(Constants.CONFIGURATION_UPDATE_EVENT);
            } catch (e) {
                if (e instanceof APIError) {
                    console.error(''.concat(Constants.APP_CONFIGURATION, e.statusCode.toString(), ' ', e.message));
                } else {
                    console.error(''.concat(Constants.APP_CONFIGURATION, 'Unexpected error: '), e);
                }
                // emit error event?
            }
        });
    }

    getFeature(featureId: string): Feature {
        if (Object.prototype.hasOwnProperty.call(getCacheInstance().features, featureId)) {
            return getCacheInstance().features[featureId];
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'Invalid feature flag id: ', featureId));
    }

    getFeatures(): { [x: string]: Feature } {
        return getCacheInstance().features;
    }

    getProperty(propertyId: string): Property {
        if (Object.prototype.hasOwnProperty.call(getCacheInstance().properties, propertyId)) {
            return getCacheInstance().properties[propertyId];
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'Invalid property id: ', propertyId));
    }

    getProperties(): { [x: string]: Property } {
        return getCacheInstance().properties;
    }

    public static getInstance() {
        if (!ConfigurationHandler.instance) {
            ConfigurationHandler.instance = new ConfigurationHandler();
        }
        return ConfigurationHandler.instance;
    }
}
