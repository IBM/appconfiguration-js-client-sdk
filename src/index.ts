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

import ConfigurationHandler from './configurationhandler';
import Feature from './models/Feature';
import Property from './models/Property';
import { fetchAvailable } from './utils/apimanager';
import * as Constants from './utils/constants';
import Emitter from './utils/events-handler';
import Metering from './utils/metering';

const configurationHandlerInstance = ConfigurationHandler.getInstance();
const metering = Metering.getInstance();
let overrideServiceUrl: string;

export default class AppConfiguration {
    private static instance: AppConfiguration;

    private isInitialized = false;

    private isInitializedContext = false;

    private constructor() {
        if (!fetchAvailable()) {
            throw new Error(''.concat(Constants.APP_CONFIGURATION, 'Either provide your own "fetch" implementation or run in an environment where "fetch" is available.'));
        }
        window.addEventListener('beforeunload', () => {
            metering.sendMetering(true);
        })
    }

    /**
     * Initialize the sdk to connect with your App Configuration service instance.
     * 
     * The method throws {@link Error} if any of the params are missing or invalid.
     *
     * @param {string} region - REGION name where the App Configuration service instance is created.
     * @param {string} guid - GUID of the App Configuration service.
     * @param {string} apikey - Client SDK APIKEY of the App Configuration service.
     * @memberof AppConfiguration
     */
    init(region: string, guid: string, apikey: string): void {
        if (!region || !guid || !apikey) {
            if (!region) {
                throw new Error(''.concat(Constants.APP_CONFIGURATION, 'region is required'));
            } else if (!guid) {
                throw new Error(''.concat(Constants.APP_CONFIGURATION, 'guid is required'));
            } else {
                throw new Error(''.concat(Constants.APP_CONFIGURATION, 'apikey is required'));
            }
        }
        configurationHandlerInstance.init(region, guid, apikey, overrideServiceUrl);
        this.isInitialized = true;
    }

    /**
     * Sets the context of the SDK.
     * 
     * throws {@link Error} if {@link init} is not performed before calling this method.
     * 
     * throws {@link Error} if `collectionId` is not passed or invalid.
     * 
     * throws {@link Error} if `environmentId` is not passed or invalid.
     *
     * @param {string} collectionId - Id of the collection created in App Configuration service instance.
     * @param {string} environmentId - Id of the environment created in App Configuration service instance.
     * @return {*}  \{Promise<void>\}
     * @memberof AppConfiguration
     */
    async setContext(collectionId: string, environmentId: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error(''.concat(Constants.APP_CONFIGURATION, 'init should be called first'));
        }

        if (!collectionId) {
            throw new Error(''.concat(Constants.APP_CONFIGURATION, 'collectionId is required'));
        }

        if (!environmentId) {
            throw new Error(''.concat(Constants.APP_CONFIGURATION, 'environmentId is required'));
        }

        this.isInitializedContext = true;
        await configurationHandlerInstance.setContext(collectionId, environmentId);
        // ADD window.beforeunload
    }

    /**
     * Returns the {@link Feature} object with the details of the feature flag specified by the `featureId`.
     *
     * throws {@link Error} if the featureId does not exists or invalid.
     *
     * throws {@link Error} if called before SDK is initialised.
     * 
     * @param {string} featureId - The Feature flag Id.
     * @return {*}  {@link Feature} object.
     * @memberof AppConfiguration
     */
    getFeature(featureId: string): Feature {
        if (this.isInitialized && this.isInitializedContext) {
            return configurationHandlerInstance.getFeature(featureId);
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'getFeature: SDK not initialised.'));
    }

    /**
     * Returns the object of type \{ [x: string]: Feature \} containing details of all the feature flags associated with the `collectionId`.
     *
     * @return {*}  \{ [x: string]: {@link Feature }\}
     * @memberof AppConfiguration
     */
    getFeatures(): { [x: string]: Feature } {
        if (this.isInitialized && this.isInitializedContext) {
            return configurationHandlerInstance.getFeatures();
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'getFeatures: SDK not initialised.'));
    }

    /**
     * Returns the {@link Property} object with the details of the property specified by the `propertyId`.
     * 
     * throws {@link Error} if the propertyId does not exists or invalid.
     * 
     * throws {@link Error} if called before SDK is initialised.
     *
     * @param {string} propertyId
     * @return {*}  \{Property\}
     * @memberof AppConfiguration
     */
    getProperty(propertyId: string): Property {
        if (this.isInitialized && this.isInitializedContext) {
            return configurationHandlerInstance.getProperty(propertyId);
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'getProperty: SDK not initialised.'));
    }

    /**
     * Returns the object of type \{ [x: string]: Property \} containing details of all the properties associated with the `collectionId`.
     *
     * @return {*}  \{ [x: string]: {@link Property } \}
     * @memberof AppConfiguration
     */
    getProperties(): { [x: string]: Property } {
        if (this.isInitialized && this.isInitializedContext) {
            return configurationHandlerInstance.getProperties();
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'getProperties: SDK not initialised.'));
    }

    /**
     * Instance of {@link EventEmitter} to listen to live configuration updates.
     *
     * @memberof AppConfiguration
     */
    emitter = Emitter;

    /**
     * @internal
     * 
     * Override the default App Configuration URL. This method should be invoked before the SDK initialization.
     * ```js
     * // Example
     * AppConfiguration.overrideServiceUrl('https://testurl.com');
     * ```
     *  NOTE: To be used for development purposes only.
     * @param url - The base url
     */
    public static overrideServiceUrl(url: string) {
        if (url) {
            overrideServiceUrl = url;
            return;
        }
        throw new Error(''.concat(Constants.APP_CONFIGURATION, 'Unexpected url passed to overrideServiceUrl()'));
    }

    /**
     * Get the instance of {@link AppConfiguration}.
     *
     * @static
     * @return {*} 
     * @memberof AppConfiguration
     */
    public static getInstance() {
        if (!AppConfiguration.instance) {
            AppConfiguration.instance = new AppConfiguration();
        }
        return AppConfiguration.instance;
    }

    public static REGION_US_SOUTH = 'us-south';

    public static REGION_EU_GB = 'eu-gb';

    public static REGION_AU_SYD = 'au-syd';

    public static REGION_US_EAST = 'us-east';

    public static REGION_EU_DE = 'eu-de';

    public static REGION_CA_TOR = 'ca-tor';

    public static REGION_JP_TOK = 'jp-tok';

    public static REGION_JP_OSA = 'jp-osa';
}
