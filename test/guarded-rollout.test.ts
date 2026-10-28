import Feature from '../src/models/Feature';
import FeatureSegmentRule from '../src/models/FeatureSegmentRule';
import Analytics from '../src/utils/analytics';
import { EventType } from '../src/utils/analyticsrecord';
import Metering from '../src/utils/metering';
import { setCache } from '../src/models/Cache';

const FEATURE_ID = 'gf-1';
const ROLLOUT_ID = 'rid-1';
const SEGMENT_ROLLOUT_ID = 'seg-rid-1';
const PERCENTAGE = 30;

const makeFeature = (overrides: Partial<ConstructorParameters<typeof Feature>[0]> = {}): Feature => new Feature({
    name: 'Guarded Feature',
    feature_id: FEATURE_ID,
    type: 'BOOLEAN',
    enabled_value: true,
    disabled_value: false,
    enabled: true,
    rollout_type: 'GUARDED',
    rollout_percentage: PERCENTAGE,
    rollout_id: ROLLOUT_ID,
    segment_rules: [],
    metric_map: { purchase: [{ id: 'm1', type: 'count' }] },
    ...overrides,
});

describe('guarded rollout', () => {
    let addMetric: jest.SpyInstance;
    let addMetering: jest.SpyInstance;

    beforeEach(() => {
        setCache({}, {}, {}, {});
        addMetric = jest.spyOn(Analytics.getInstance(), 'addMetric').mockImplementation(() => undefined);
        addMetering = jest.spyOn(Metering.getInstance(), 'addMetering').mockImplementation(() => undefined);
    });

    afterEach(() => {
        addMetric.mockRestore();
        addMetering.mockRestore();
        Analytics.getInstance().stop();
    });

    test('reads guarded rollout data and metric map', () => {
        const feature = makeFeature();
        expect(feature.getRolloutId()).toBe(ROLLOUT_ID);
        expect(feature.getMetricMap()).toEqual({ purchase: [{ id: 'm1', type: 'count' }] });
    });

    test('serves target and records guarded evaluation for target entity', () => {
        expect(makeFeature().getCurrentValue('u17')).toBe(true);
        expect(addMetric).toHaveBeenCalledWith(
            expect.objectContaining({ rollout_id: ROLLOUT_ID, entity_id: 'u17', value_served: 'target' }),
            EventType.GUARDED_EVALUATION,
        );
    });

    test('serves original and records guarded evaluation for original entity', () => {
        expect(makeFeature().getCurrentValue('u1')).toBe(false);
        expect(addMetric).toHaveBeenCalledWith(
            expect.objectContaining({ rollout_id: ROLLOUT_ID, entity_id: 'u1', value_served: 'original' }),
            EventType.GUARDED_EVALUATION,
        );
    });

    test('does not record evaluation outside target and original ranges', () => {
        expect(makeFeature().getCurrentValue('u2')).toBe(false);
        expect(addMetric).not.toHaveBeenCalled();
    });

    test('does not record evaluation when the feature is disabled', () => {
        expect(makeFeature({ enabled: false }).getCurrentValue('u17')).toBe(false);
        expect(addMetric).not.toHaveBeenCalled();
    });

    test('records guarded metric for a target entity', () => {
        makeFeature().track('purchase', 'u17');
        expect(addMetric).toHaveBeenCalledWith(
            expect.objectContaining({ rollout_id: ROLLOUT_ID, entity_id: 'u17', event_key: 'purchase', value_served: 'target' }),
            EventType.GUARDED_METRIC,
        );
    });

    test('skips unknown metric events and entities outside both ranges', () => {
        makeFeature().track('unknown', 'u17');
        makeFeature().track('purchase', 'u2');
        expect(addMetric).not.toHaveBeenCalled();
    });

    describe('track() input validation', () => {
        test('rejects empty string entityId', () => {
            makeFeature().track('purchase', '');
            expect(addMetric).not.toHaveBeenCalled();
        });

        test('rejects whitespace-only entityId', () => {
            makeFeature().track('purchase', '   ');
            expect(addMetric).not.toHaveBeenCalled();
        });

        test('rejects empty string eventKey', () => {
            makeFeature().track('', 'u17');
            expect(addMetric).not.toHaveBeenCalled();
        });

        test('rejects whitespace-only eventKey', () => {
            makeFeature().track('  ', 'u17');
            expect(addMetric).not.toHaveBeenCalled();
        });

        test('rejects non-string entityId', () => {
            (makeFeature() as any).track('purchase', 123);
            expect(addMetric).not.toHaveBeenCalled();
        });

        test('rejects non-string eventKey', () => {
            (makeFeature() as any).track(42, 'u17');
            expect(addMetric).not.toHaveBeenCalled();
        });
    });

    test('uses a guarded segment rollout for tracking and evaluation', () => {
        const feature = makeFeature({
            rollout_type: 'MANUAL',
            rollout_id: null,
            rollout_percentage: 100,
            segment_rules: [new FeatureSegmentRule({
                rules: [{ segments: ['segment-1'] }],
                value: '$default',
                order: 1,
                rollout_type: 'GUARDED',
                rollout_percentage: PERCENTAGE,
                rollout_id: SEGMENT_ROLLOUT_ID,
            })],
        });
        setCache({}, {}, {
            'segment-1': { evaluateRule: () => true } as never,
        }, {});
        expect(feature.getCurrentValue('u2', { role: 'admin' })).toBe(true);
        expect(addMetric).toHaveBeenCalledWith(
            expect.objectContaining({ rollout_id: SEGMENT_ROLLOUT_ID, value_served: 'target' }),
            EventType.GUARDED_EVALUATION,
        );
    });
});
