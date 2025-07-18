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

export interface IExperiment {
    experiment_id: string;
    experiment_status?: string;
    traffic_distribution: TrafficDistribution;
    iteration: Iteration;
    variations: Variation[];
    metrics: Metric[];
}

export interface TrafficDistribution {
    type: string;
    rule_id: string;
    control_group: Group;
    experimental_group: Group[];
    traffic_reassignment: boolean;
}

export interface Group {
    variation_id: string;
    rollout_percentage: number;
}

export interface Iteration {
    iteration_id: string;
    iteration_key: string;
}

export interface Variation {
    variation_id: string;
    variation_value: string;
}

export interface Metric {
    metric_id: string;
    primary: boolean;
    metric_type: string;
    event_type: string;
    event_key: string;
}
