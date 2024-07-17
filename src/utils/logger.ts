/**
 * Copyright 2024 IBM Corp. All Rights Reserved.
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

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

interface LoggerConfig {
    level: LogLevel;
}

const defaultConfig: LoggerConfig = {
    level: 'info',
};

let loggerConfig: LoggerConfig = { ...defaultConfig };

export const setLoggerConfig = (config: Partial<LoggerConfig>) => {
    loggerConfig = { ...loggerConfig, ...config };
};

const getLoggerConfig = (): LoggerConfig => loggerConfig;

class Logger {
    private static instance: Logger;

    private constructor() { /* singleton design pattern */ }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private log(level: LogLevel, ...messages: any[]) {
        const config = getLoggerConfig();
        const levels: LogLevel[] = ['debug', 'info', 'warning', 'error'];

        if (levels.indexOf(level) >= levels.indexOf(config.level)) {
            console.log(`${Constants.APP_CONFIGURATION}[${level.toUpperCase()}]`, ...messages);
        }
    }

    debug(...messages: any[]) {
        this.log('debug', ...messages);
    }

    info(...messages: any[]) {
        this.log('info', ...messages);
    }

    warning(...messages: any[]) {
        this.log('warning', ...messages);
    }

    error(...messages: any[]) {
        this.log('error', ...messages);
    }
}

export const logger = Logger.getInstance();
