import * as Constants from './constants';

export enum EventType {
    GUARDED_METRIC = 'GUARDED_METRIC',
    GUARDED_EVALUATION = 'GUARDED_EVALUATION',
}

export interface AnalyticsMetric {
    [key: string]: unknown;
}

export default class AnalyticsRecord {
    private usages: AnalyticsMetric[] = [];
    private history: { [key: string]: number } = {};

    private metricKey(metric: AnalyticsMetric, type: EventType): string {
        const values = type === EventType.GUARDED_EVALUATION
                    ? [metric.rollout_id, metric.entity_id, metric.value_served]
                    : [metric.rollout_id, metric.entity_id, metric.value_served, metric.event_key];
        return values.join(Constants.DELIMITER);
    }

    add(metric: AnalyticsMetric, type: EventType): void {
        const entry = { ...metric };
        entry.metadata = { feature: 'guarded', event_type: type === EventType.GUARDED_EVALUATION ? 'evaluation' : 'metric' };
        const key = this.metricKey(entry, type);
        const index = this.history[key];
        if (index === undefined) {
            if (type === EventType.GUARDED_METRIC) entry.count = 1;
            this.history[key] = this.usages.length;
            this.usages.push(entry);
        } else if (type === EventType.GUARDED_METRIC) {
            this.usages[index].count = Number(this.usages[index].count) + 1;
            const currentTimestamp = String(this.usages[index].timestamp || '');
            const entryTimestamp = String(entry.timestamp || '');
            this.usages[index].timestamp = currentTimestamp > entryTimestamp ? currentTimestamp : entryTimestamp;
        }
    }

    getRequestBody(environmentId: string, collectionId: string): { environment_id: string; collection_id: string; usages: AnalyticsMetric[] } {
        return {
            environment_id: environmentId,
            collection_id: collectionId,
            usages: this.usages.map((usage) => {
                const entry = { ...usage };
                delete entry.event_key;
                return entry;
            }),
        };
    }

    getLength(): number { return this.usages.length; }

    /**
     * Atomically removes the first `n` entries (oldest) and returns them as a
     * new independent AnalyticsRecord. The original record retains entries n..end.
     * Both head and remainder have their history maps fully rebuilt so dedup
     * continues to work on each independently.
     * Safe when n > length: returns all entries.
     */
    splitHead(n: number): AnalyticsRecord {
        const head = new AnalyticsRecord();
        head.usages = this.usages.slice(0, n);
        this.usages = this.usages.slice(n);

        // Rebuild history maps for both.
        head.history = {};
        head.usages.forEach((usage, idx) => {
            const metadata = usage.metadata as { feature: string; event_type: string };
            const type = metadata.event_type === 'evaluation' ? EventType.GUARDED_EVALUATION : EventType.GUARDED_METRIC;
            head.history[head.metricKey(usage, type)] = idx;
        });

        this.history = {};
        this.usages.forEach((usage, idx) => {
            const metadata = usage.metadata as { feature: string; event_type: string };
            const type = metadata.event_type === 'evaluation' ? EventType.GUARDED_EVALUATION : EventType.GUARDED_METRIC;
            this.history[this.metricKey(usage, type)] = idx;
        });

        return head;
    }

    merge(other: AnalyticsRecord): void {
        other.usages.forEach((usage) => {
            const metadata = usage.metadata as { feature: string; event_type: string };
            const type = metadata.event_type === 'evaluation' ? EventType.GUARDED_EVALUATION : EventType.GUARDED_METRIC;
            const key = this.metricKey(usage, type);
            const index = this.history[key];
            if (index === undefined) {
                this.history[key] = this.usages.length;
                this.usages.push({ ...usage });
            } else if (type === EventType.GUARDED_METRIC) {
                this.usages[index].count = Number(this.usages[index].count) + Number(usage.count);
                const currentTimestamp = String(this.usages[index].timestamp || '');
                const usageTimestamp = String(usage.timestamp || '');
                this.usages[index].timestamp = currentTimestamp > usageTimestamp ? currentTimestamp : usageTimestamp;
            }
        });
    }
}
