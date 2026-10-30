import AnalyticsRecord, { EventType } from '../src/utils/analyticsrecord';

const evaluation = (entityId: string, valueServed = 'target') => ({
    rollout_id: 'rid-1',
    entity_id: entityId,
    value_served: valueServed,
});

const metric = (eventKey: string) => ({
    rollout_id: 'rid-1',
    entity_id: 'u17',
    value_served: 'target',
    event_key: eventKey,
});

describe('AnalyticsRecord', () => {
    test('adds and deduplicates guarded evaluations', () => {
        const record = new AnalyticsRecord();
        record.add(evaluation('u17'), EventType.GUARDED_EVALUATION);
        record.add(evaluation('u17'), EventType.GUARDED_EVALUATION);

        expect(record.getLength()).toBe(1);
        expect(record.getRequestBody('env-1', 'col-1').usages[0]).toMatchObject({
            rollout_id: 'rid-1',
            entity_id: 'u17',
            value_served: 'target',
            metadata: { feature: 'guarded', event_type: 'evaluation' },
        });
        expect(record.getRequestBody('env-1', 'col-1').usages[0]).not.toHaveProperty('count');
    });

    test('keeps target and original evaluations distinct', () => {
        const record = new AnalyticsRecord();
        record.add(evaluation('u17', 'target'), EventType.GUARDED_EVALUATION);
        record.add(evaluation('u17', 'original'), EventType.GUARDED_EVALUATION);
        expect(record.getLength()).toBe(2);
    });

    test('aggregates guarded metrics and strips event_key from requests', () => {
        const record = new AnalyticsRecord();
        record.add(metric('click'), EventType.GUARDED_METRIC);
        record.add(metric('click'), EventType.GUARDED_METRIC);
        const body = record.getRequestBody('env-1', 'col-1');

        expect(body.usages).toHaveLength(1);
        expect(body.usages[0].count).toBe(2);
        expect(body.usages[0]).not.toHaveProperty('event_key');
    });

    test('keeps different metric event keys distinct', () => {
        const record = new AnalyticsRecord();
        record.add(metric('click'), EventType.GUARDED_METRIC);
        record.add(metric('purchase'), EventType.GUARDED_METRIC);
        expect(record.getLength()).toBe(2);
    });

    test('merges records and aggregates overlapping metrics', () => {
        const first = new AnalyticsRecord();
        first.add(metric('click'), EventType.GUARDED_METRIC);

        const second = new AnalyticsRecord();
        second.add(metric('click'), EventType.GUARDED_METRIC);
        second.add(metric('click'), EventType.GUARDED_METRIC);
        second.add(evaluation('u19'), EventType.GUARDED_EVALUATION);

        first.merge(second);
        const usages = first.getRequestBody('env-1', 'col-1').usages;
        expect(first.getLength()).toBe(2);
        expect(usages.find((usage) => usage.rollout_id === 'rid-1' && usage.entity_id === 'u17')?.count).toBe(3);
        expect(usages.some((usage) => usage.entity_id === 'u19')).toBe(true);
    });

    describe('splitHead', () => {
        test('splits first n entries into head, remainder stays in original', () => {
            const record = new AnalyticsRecord();
            record.add(evaluation('u1'), EventType.GUARDED_EVALUATION);
            record.add(evaluation('u2'), EventType.GUARDED_EVALUATION);
            record.add(evaluation('u3'), EventType.GUARDED_EVALUATION);

            const head = record.splitHead(2);

            expect(head.getLength()).toBe(2);
            expect(record.getLength()).toBe(1);
        });

        test('head deduplication works independently after split', () => {
            const record = new AnalyticsRecord();
            record.add(evaluation('u1'), EventType.GUARDED_EVALUATION);
            record.add(evaluation('u2'), EventType.GUARDED_EVALUATION);

            const head = record.splitHead(1);

            // Adding u1 again to head should deduplicate (not grow).
            head.add(evaluation('u1'), EventType.GUARDED_EVALUATION);
            expect(head.getLength()).toBe(1);

            // Adding u2 again to remainder should also deduplicate.
            record.add(evaluation('u2'), EventType.GUARDED_EVALUATION);
            expect(record.getLength()).toBe(1);
        });

        test('splitHead with n >= length returns all entries and leaves original empty', () => {
            const record = new AnalyticsRecord();
            record.add(evaluation('u1'), EventType.GUARDED_EVALUATION);
            record.add(evaluation('u2'), EventType.GUARDED_EVALUATION);

            const head = record.splitHead(10);

            expect(head.getLength()).toBe(2);
            expect(record.getLength()).toBe(0);
        });

        test('head getRequestBody excludes event_key', () => {
            const record = new AnalyticsRecord();
            record.add(metric('click'), EventType.GUARDED_METRIC);

            const head = record.splitHead(1);
            const body = head.getRequestBody('env-1', 'col-1');

            expect(body.usages[0]).not.toHaveProperty('event_key');
            expect(body.usages[0].count).toBe(1);
        });
    });
});

describe('Analytics empty-send guard', () => {
    let postSpy: jest.SpyInstance;

    beforeEach(() => {
        postSpy = jest.spyOn(require('../src/utils/apimanager'), 'retryablePostAnalytics')
            .mockResolvedValue(undefined);
    });

    afterEach(() => {
        postSpy.mockRestore();
    });

    test('flushRemainder does not POST when the record is empty', async () => {
        // Access internals via the private method directly to simulate the 5-min trigger
        // without relying on real/fake timers. Cast to any to reach private methods.
        const Analytics = require('../src/utils/analytics').default;
        const instance = Analytics.getInstance() as any;
        instance.record = new AnalyticsRecord(); // ensure clean empty record
        await instance.flushRemainder();
        expect(postSpy).not.toHaveBeenCalled();
    });

    test('drainChunks does not POST when the record is below BATCH_SIZE', async () => {
        const Analytics = require('../src/utils/analytics').default;
        const instance = Analytics.getInstance() as any;
        instance.record = new AnalyticsRecord();
        // Add fewer entries than BATCH_SIZE (30)
        instance.record.add({ rollout_id: 'r', entity_id: 'e', value_served: 'target',
            metadata: { feature: 'guarded', event_type: 'evaluation' }, timestamp: 't' }, EventType.GUARDED_EVALUATION);
        await instance.drainChunks();
        expect(postSpy).not.toHaveBeenCalled();
    });

    test('sendBatch POSTs exactly the entries in the batch', async () => {
        const Analytics = require('../src/utils/analytics').default;
        const instance = Analytics.getInstance() as any;
        instance.setContext('env-1', 'col-1');
        const batch = new AnalyticsRecord();
        batch.add(evaluation('u99'), EventType.GUARDED_EVALUATION);
        await instance.sendBatch(batch);
        expect(postSpy).toHaveBeenCalledTimes(1);
        const body = postSpy.mock.calls[0][0];
        expect(body.usages).toHaveLength(1);
        expect(body.usages[0].entity_id).toBe('u99');
    });
});
