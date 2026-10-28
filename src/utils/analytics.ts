import { retryablePostAnalytics } from './apimanager';
import AnalyticsRecord, { AnalyticsMetric, EventType } from './analyticsrecord';
import { logger } from './logger';

const SEND_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 30;                // max usages server accepts per POST

export default class Analytics {
    private static instance: Analytics;
    private environmentId: string | undefined;
    private collectionId: string | undefined;
    private record = new AnalyticsRecord();
    private running = false;

    // Holds the resolve callback of the active sleep. Calling it wakes the loop early.
    private wakeResolve: (() => void) | null = null;

    private constructor() { /* singleton design pattern */ }

    static getInstance(): Analytics {
        if (!Analytics.instance) Analytics.instance = new Analytics();
        return Analytics.instance;
    }

    setContext(environmentId: string, collectionId: string): void {
        this.environmentId = environmentId;
        this.collectionId = collectionId;
    }

    addMetric(metric: AnalyticsMetric, type: EventType): void {
        this.record.add({ ...metric, timestamp: `${new Date().toISOString().split('.')[0]}Z` }, type);
        if (this.record.getLength() >= BATCH_SIZE) {
            this.wake();
        }
        this.start();
    }

    start(): void {
        if (!this.running) {
            this.running = true;
            void this.runLoop();
        }
    }

    stop(): void {
        this.running = false;
        this.wake(); // unblock any active sleep so the loop can exit cleanly
    }

    /**
     * Immediately flush all pending data to the server — full batches first,
     * then any remainder. Mirrors node-sdk Analytics.flush().
     * Safe to call at any time, including on page unload / shutdown.
     */
    async flush(): Promise<void> {
        await this.drainChunks();
        await this.flushRemainder();
    }

    // ─── private ──────────────────────────────────────────────────────────────

    /** Wake the currently sleeping loop early. No-op when not sleeping. */
    private wake(): void {
        if (this.wakeResolve !== null) {
            const resolve = this.wakeResolve;
            this.wakeResolve = null;
            resolve();
        }
    }

    /** Sleep for `ms` ms; can be interrupted early by calling wake(). */
    private sleep(ms: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const tid = setTimeout(() => {
                this.wakeResolve = null;
                resolve();
            }, ms);
            this.wakeResolve = () => {
                clearTimeout(tid);
                resolve();
            };
        });
    }

    /** POST one batch; retries with exponential back-off on failure. */
    private async sendBatch(batch: AnalyticsRecord): Promise<void> {
        try {
            await retryablePostAnalytics(
                batch.getRequestBody(this.environmentId as string, this.collectionId as string),
                false,
            );
        } catch (error) {
            // Merge failed batch back so data is not lost.
            this.record.merge(batch);
            logger.error('Error while posting analytics data:' + (error instanceof Error ? error.message : String(error)));
        }
    }

    /** Drain all full batches (≥ BATCH_SIZE) from the record. */
    private async drainChunks(): Promise<void> {
        while (this.record.getLength() >= BATCH_SIZE) {
            const batch = this.record.splitHead(BATCH_SIZE);
            await this.sendBatch(batch); // eslint-disable-line no-await-in-loop
            if (!this.running) return;
        }
    }

    /** Flush everything remaining in the record (called by 5-min timer). */
    private async flushRemainder(): Promise<void> {
        if (this.record.getLength() === 0) return;
        const batch = this.record.splitHead(this.record.getLength());
        await this.sendBatch(batch);
    }

    /**
     * Background flush loop — mirrors the node-sdk Analytics.__sendAnalyticJob:
     *  - sleeps up to 5 min, wakes early when record reaches BATCH_SIZE
     *  - if record ≥ BATCH_SIZE: drain full batches
     *  - if 5 min elapsed and record non-empty: flush remainder
     *  - never POSTs an empty payload
     */
    private async runLoop(): Promise<void> {
        let lastFlush = Date.now();

        while (this.running) {
            const remaining = SEND_INTERVAL - (Date.now() - lastFlush);
            if (remaining > 0 && this.record.getLength() < BATCH_SIZE) {
                await this.sleep(remaining); // eslint-disable-line no-await-in-loop
            }

            if (!this.running) break;

            const fiveMinDue = (Date.now() - lastFlush) >= SEND_INTERVAL;

            if (this.record.getLength() >= BATCH_SIZE) {
                await this.drainChunks(); // eslint-disable-line no-await-in-loop
            } else if (fiveMinDue && this.record.getLength() > 0) {
                await this.flushRemainder(); // eslint-disable-line no-await-in-loop
            }
            lastFlush = Date.now();
            // Woken early but record < BATCH_SIZE and 5-min not elapsed:
            // loop back and sleep for the remaining time.
        }
    }
}
