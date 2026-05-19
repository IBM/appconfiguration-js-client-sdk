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

import BTree from 'sorted-btree';
import { Logger } from './logger';
import * as Constants from "./constants";

const logger = new Logger(Constants.APP_CONFIGURATION);

export interface RolloutPhase {
    percentage: number;
    duration: number | null;
    duration_type: string | null;
}

export interface RolloutConfiguration {
    start_at: string;
    phases: RolloutPhase[];
}

export class PhaseScheduler {
    static timestamps: number[] = [];  // Sorted array of timestamps

    static timerId: ReturnType<typeof setTimeout> | null = null;

    static onPhaseCallback: () => void;

    private constructor() {
        // empty
    }

    // Add timestamp in sorted order (no duplicates)
    static addTimestamp(timestamp: number): void {
        let insertIndex = 0;
        for (let i = 0; i < this.timestamps.length; i+=1) {
            if (timestamp === this.timestamps[i]) {
                return;
            }
            if (this.timestamps[i] > timestamp) {
                break;
            }
            insertIndex = i + 1;
        }
        // Insert at correct position
        this.timestamps.splice(insertIndex, 0, timestamp);
        // If this is first timestamp or earlier than current scheduled, reschedule
        if (insertIndex === 0) {
            this.scheduleNext();
        }
    }

    // Schedule timer for first (earliest) timestamp
    private static scheduleNext(): void {
        // Clear existing timer
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        const currentTime = Date.now();

        // Remove all past timestamps first
        while (this.timestamps.length > 0 && this.timestamps[0] <= currentTime) {
            this.timestamps.shift();
        }
        // call once to cover all the previous scheduled phases
        this.onPhaseCallback();

        // Check if there are any future timestamps
        if (this.timestamps.length === 0) {
            return; // No more timestamps to schedule
        }

        // Schedule timer for the first (earliest) future timestamp
        const nextTimestamp = this.timestamps[0];
        const delay = nextTimestamp - currentTime;

        this.timerId = setTimeout(() => {
            // Remove the executed timestamp
            this.timestamps.shift();
            // Execute callback
            this.onPhaseCallback();
            // Schedule next timestamp
            this.scheduleNext();
        }, delay);
    }

    // Reset: clear timer and flush array
    static reset(): void {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        this.timestamps = [];
    }
}

/**
 * Parses progressive rollout phases into a B-Tree for efficient timestamp-to-percentage lookups
 * @param configuration - The rollout configuration object
 * @returns BTree mapping timestamp (ms) to percentage, or null on error
 */
export function parseRolloutConfigurationPhases(
    configuration: RolloutConfiguration | null | undefined
): BTree<number, number> | null {
    if (!configuration || !configuration.start_at || !configuration.phases || configuration.phases.length === 0) {
        return null;
    }

    try {
        // Parse start timestamp
        const startTime = new Date(configuration.start_at);
        if (Number.isNaN(startTime.getTime())) {
            logger.log(`Invalid start_at: ${configuration.start_at}`);
            return null;
        }

        const result = new BTree();
        result.set(0, 0);

        let transitionTime = startTime.getTime();

        // Duration multipliers in milliseconds
        const multipliers: { [key: string]: number } = {
            days: 86400000, // days
            hours: 3600000, // hours
            minutes: 60000, // minutes
        };

        configuration.phases.forEach((phase) => {
            // Add phase entry
            result.set(transitionTime, phase.percentage);
            PhaseScheduler.addTimestamp(transitionTime);
            // Calculate next transition time if duration is specified
            if (phase.duration && phase.duration_type) {
                transitionTime += multipliers[phase.duration_type] * phase.duration;
            }
        });

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.log(`Error parsing rollout configuration: ${errorMessage}`);
        return null;
    }
}

/**
 * Returns the current rollout percentage based on current time
 * @param rolloutMap - BTree mapping timestamp to percentage
 * @returns Current rollout percentage
 */
export function getCurrentRolloutPercentage(rolloutMap: BTree<number, number> | null): number {
    if (!rolloutMap || rolloutMap.size === 0) {
        return 0;
    }
    const currentTime = Date.now();
    // Use getPairOrNextLower to find the entry with the largest timestamp that is <= currentTime
    const entry = rolloutMap.getPairOrNextLower(currentTime);
    if (entry && entry.length > 1) {
        return entry[1];
    }
    return 0;
}
