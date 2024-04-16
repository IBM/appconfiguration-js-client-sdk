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
import { SdkConfigResponse } from './models/SdkConfigResponse';
import Feature, { IFeature } from './models/Feature';
import Property, { IProperty } from './models/Property';
import Segment from './models/Segment';
import { EventSourcePolyfill } from './polyfill/eventsource';
import * as Constants from './utils/constants';
import Emitter from './utils/events-handler';
import Metering from './utils/metering';
import UrlBuilder from './utils/urlbuilder';
import { Logger } from './utils/logger';

const urlBuilder = UrlBuilder.getInstance();
const metering = Metering.getInstance();
const logger = new Logger(Constants.APP_CONFIGURATION);

export default class ConfigurationHandler {
    private static instance: ConfigurationHandler;

    private constructor() { /* singleton design pattern */ }

    private region: string | undefined;

    private guid: string | undefined;

    private apikey: string | undefined;

    private overrideServiceUrl: string | undefined;

    init(region: string, guid: string, apikey: string, overrideServiceUrl: string) {
        this.region = region;
        this.guid = guid;
        this.apikey = apikey;
        this.overrideServiceUrl = overrideServiceUrl;
    }

    async setContext(collectionId: string, environmentId: string): Promise<void> {
        urlBuilder.init({
            region: this.region as string,
            guid: this.guid as string,
            apikey: this.apikey as string,
            overrideServiceUrl: this.overrideServiceUrl as string,
            collectionId,
            environmentId,
        })
        metering.init(collectionId, environmentId);
        await this.connectEventSource();
    }

    saveInCache(data: SdkConfigResponse) {

        const _featureMap: { [x: string]: Feature } = {};
        if (Object.keys(data.environments[0].features).length) {
            const featuresList: IFeature[] = data.environments[0].features;
            featuresList.forEach((feature) => {
                _featureMap[feature.feature_id] = new Feature(feature);
            });
        }

        const _propertyMap: { [x: string]: Property } = {};
        if (Object.keys(data.environments[0].properties).length) {
            const propertiesList: IProperty[] = data.environments[0].properties;
            propertiesList.forEach((property) => {
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

    connectEventSource(): Promise<void> {
        const url = urlBuilder.getEventSourceUrl();
        const headers = urlBuilder.getEventSourceHeaders();
        const source = new EventSourcePolyfill(url, headers);

        source.addEventListener<'SSEConfig_payload'>('SSEConfig_payload', (event) => {
            const eventData: SdkConfigResponse = JSON.parse(event.data);
            logger.log("Update event received.");
            this.saveInCache(eventData);
            Emitter.emit(Constants.CONFIGURATION_UPDATE_EVENT);
        });

        return new Promise<void>((resolve, reject) => {
            source.addEventListener('error', (err) => {
                reject(err)
            });

            source.addEventListener<'Registration'>('Registration', (event) => {
                const eventData: SdkConfigResponse = JSON.parse(event.data);
                logger.log("Client registration complete.");
                this.saveInCache(eventData);
                Emitter.emit(Constants.REGISTRATION_EVENT);
                resolve();
            });
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
