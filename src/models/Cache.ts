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

import Feature from './Feature';
import Property from './Property';
import Segment from './Segment';

interface Cache {
    features: { [x: string]: Feature };
    properties: { [x: string]: Property };
    segments: { [x: string]: Segment };
}

let cacheInstance: Cache;

export function setCache(
    features: { [x: string]: Feature },
    properties: { [x: string]: Property },
    segments: { [x: string]: Segment }
) {
    const cache: Cache = {
        features: {},
        properties: {},
        segments: {},
    };
    cache.features = features;
    cache.properties = properties;
    cache.segments = segments;
    cacheInstance = cache;
}

export function getCacheInstance(): Cache {
    return cacheInstance;
}
