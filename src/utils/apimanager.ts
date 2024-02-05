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
import * as Constants from './constants';
import { APIError } from './custom-error';
import { MeteringRequestBody } from './metering';
import UrlBuilder from './urlbuilder';

const urlBuilder = UrlBuilder.getInstance();

export function fetchAvailable(): boolean {
    if ('fetch' in window) {
        return true;
    }
    return false;
}

export async function retryablePostMetering(
    data: MeteringRequestBody,
    keepalive: boolean,
    retries: number = Constants.NUMBER_OF_RETRIES
): Promise<void> {
    const url = urlBuilder.getMeteringUrl();
    const params: RequestInit = {
        method: 'POST',
        headers: urlBuilder.getAPICallHeaders(true),
        body: JSON.stringify(data),
    };
    if (keepalive) params.keepalive = true;
    return fetch(url, params).then(async (response) => {
        if (response.ok) {
            return;
        }
        if ((response.status >= 500 && response.status <= 599) || response.status === 429) {
            if (retries > 1) {
                return retryablePostMetering(data, keepalive, retries - 1);
            }
        }
        throw new APIError(await response.text(), response.status);
    });
}
