import UrlBuilder from '../src/utils/urlbuilder';
import { logger } from '../src/utils/logger';
import Metering from '../src/utils/metering';
import { retryableGetConfig, retryablePostAnalytics, retryablePostMetering } from '../src/utils/apimanager';
import { APIError } from '../src/utils/custom-error';
import { PhaseScheduler, getCurrentRolloutPercentage, parseRolloutConfigurationPhases } from '../src/utils/rollout';

const builder = UrlBuilder.getInstance();

beforeAll(() => {
    (globalThis as any).navigator = { userAgent: 'jest' };
    builder.init({
        region: 'us-south', guid: 'guid', apikey: 'apikey', collectionId: 'collection',
        environmentId: 'environment', overrideServiceUrl: '', isRestrictedNetwork: false,
    });
});

afterEach(() => {
    jest.restoreAllMocks();
    Metering.getInstance().stop();
});

describe('UrlBuilder', () => {
    test('builds service URLs', () => {
        expect(builder.getBaseServiceUrl()).toBe('https://us-south.apprapp.cloud.ibm.com');
        expect(builder.getConfigUrl()).toContain('/config?action=sdkConfig&collection_id=collection&environment_id=environment');
        expect(builder.getMeteringUrl()).toContain('/usage');
        expect(builder.getAnalyticsUrl()).toContain('/analytics');
        expect(builder.getEventSourceUrl()).toContain('/sse/subscribe?collection_id=collection');
    });

    test('builds restricted event source URL and headers', () => {
        builder.init({
            region: 'eu-gb', guid: 'g', apikey: 'key', collectionId: 'c', environmentId: 'e',
            overrideServiceUrl: 'https://custom.example', isRestrictedNetwork: true,
        });
        expect(builder.getBaseServiceUrl()).toBe('https://custom.example');
        expect(builder.getEventSourceUrl()).toContain('&events_only=true');
        expect(builder.getAPICallHeaders(true).get('Authorization')).toBe('key');
        expect(builder.getAPICallHeaders(true).get('Content-Type')).toBe('application/json');
        expect(builder.getEventSourceHeaders().heartbeatTimeout).toBe(600000);
    });
});

describe('rollout helpers', () => {
    afterEach(() => PhaseScheduler.reset());

    test('rejects missing and invalid configurations', () => {
        expect(parseRolloutConfigurationPhases(null)).toBeNull();
        expect(parseRolloutConfigurationPhases({ start_at: 'invalid', phases: [{ percentage: 10, duration: null, duration_type: null }] })).toBeNull();
        expect(getCurrentRolloutPercentage(null)).toBe(0);
    });

    test('parses phases and returns the current percentage', () => {
        PhaseScheduler.onPhaseCallback = jest.fn();
        const now = Date.now();
        const map = parseRolloutConfigurationPhases({
            start_at: new Date(now - 3600000).toISOString(),
            phases: [
                { percentage: 10, duration: 1, duration_type: 'hours' },
                { percentage: 50, duration: null, duration_type: null },
            ],
        });
        expect(map).not.toBeNull();
        expect(getCurrentRolloutPercentage(map)).toBe(50);
    });

    test('scheduler deduplicates timestamps and invokes callback', () => {
        const callback = jest.fn();
        PhaseScheduler.onPhaseCallback = callback;
        const timestamp = Date.now() - 1;
        PhaseScheduler.addTimestamp(timestamp);
        PhaseScheduler.addTimestamp(timestamp);
        expect(callback).toHaveBeenCalled();
        expect(PhaseScheduler.timestamps).toHaveLength(0);
    });
});

describe('logger', () => {
    test('honors configured log levels', () => {
        const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        logger.info('ignored');
        logger.info('shown');
        logger.info('shown');
        expect(output).toHaveBeenCalledTimes(3);
    });
});

describe('API manager retries', () => {
    beforeEach(() => {
        builder.init({ region: 'r', guid: 'g', apikey: 'k', collectionId: 'c', environmentId: 'e', overrideServiceUrl: '', isRestrictedNetwork: false });
    });

    test('retries GET on server errors and returns JSON', async () => {
        const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('busy', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ environments: [] }), { status: 200 }));
        await expect(retryableGetConfig(2)).resolves.toEqual({ environments: [] });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('throws APIError for non-retryable GET errors', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad request', { status: 400 }));
        await expect(retryableGetConfig(2)).rejects.toBeInstanceOf(APIError);
    });

    test('posts analytics and metering with keepalive', async () => {
        const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
        const body = { environment_id: 'e', collection_id: 'c', usages: [] };
        await retryablePostAnalytics(body, true);
        await retryablePostMetering(body, true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][1]?.keepalive).toBe(true);
    });
});

describe('Metering', () => {
    test('aggregates feature and property usage and sends request bodies', async () => {
        const post = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
        const metering = Metering.getInstance();
        metering.init('collection', 'environment');
        metering.addMetering('entity', 'segment', 'feature', null);
        metering.addMetering('entity', 'segment', 'feature', null);
        metering.addMetering('entity', 'segment', null, 'property');
        await metering.sendMetering(false);
        expect(post).toHaveBeenCalledTimes(2);
        expect(JSON.parse(String(post.mock.calls[0][1]?.body)).usages[0].count).toBe(2);
    });
});
