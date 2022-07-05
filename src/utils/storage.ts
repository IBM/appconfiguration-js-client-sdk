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

const prefix = 'ibmappconfig:';

interface Storage {
    save: (name: string, data: any) => void;
    get: (name: string) => any;
    remove: (name: string) => void;
    clear: () => void;
}

class InMemoryStorage implements Storage {
    private map = new Map();

    public save(name: string, data: any) {
        const key = ''.concat(prefix, name);
        this.map.set(key, data);
    }

    public get(name: string) {
        const key = ''.concat(prefix, name);
        return this.map.get(key);
    }

    public remove(name: string) {
        const key = ''.concat(prefix, name);
        this.map.delete(key);
    }

    public clear() {
        this.map.clear();
    }

}

class LocalStorage implements Storage {
    public save(name: string, data: any) {
        const key = ''.concat(prefix, name);
        window.localStorage.setItem(key, JSON.stringify(data));
    }

    public get(name: string) {
        const key = ''.concat(prefix, name);
        const data = window.localStorage.getItem(key);
        return data ? JSON.parse(data) : undefined;
    }

    public remove(name: string) {
        const key = ''.concat(prefix, name);
        window.localStorage.removeItem(key);
    }

    public clear() {
        window.localStorage.clear();
    }

}

function isLocalStorageAvailable() {
    let storage_1;
    try {
        storage_1 = window.localStorage;
        const x = '__ibm_appconfig_storage_test__';
        storage_1.setItem(x, x);
        storage_1.removeItem(x);
        return true;
    } catch (e) {
        return (
            e instanceof DOMException &&
            (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            storage_1 &&
            storage_1.length !== 0
        );
    }
}

export const storage: Storage = isLocalStorageAvailable() ? new LocalStorage() : new InMemoryStorage();
