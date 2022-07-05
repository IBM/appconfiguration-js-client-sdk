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

import { IFeature } from './Feature';
import { IProperty } from './Property';
import { ISegment } from './Segment';

export interface ConfigResponse {
    features: IFeature[];
    properties: IProperty[];
    segments: ISegment[];
}

export function instanceOfConfigResponse(obj: any): obj is ConfigResponse {
    return 'features' in obj && 'properties' in obj && 'segments' in obj;
}
