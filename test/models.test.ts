import Feature from '../src/models/Feature';
import Property from '../src/models/Property';
import Segment from '../src/models/Segment';
import FeatureSegmentRule from '../src/models/FeatureSegmentRule';
import PropertySegmentRule from '../src/models/PropertySegmentRule';
import Rule from '../src/models/Rule';
import Metering from '../src/utils/metering';
import { setCache } from '../src/models/Cache';

const feature = (overrides: Partial<ConstructorParameters<typeof Feature>[0]> = {}) => new Feature({
    name: 'feature', feature_id: 'feature', type: 'BOOLEAN', enabled_value: true,
    disabled_value: false, enabled: true, segment_rules: [], ...overrides,
});

describe('Feature model', () => {
    test.each([
        ['name', (f: Feature) => f.getFeatureName(), 'feature'],
        ['id', (f: Feature) => f.getFeatureId(), 'feature'],
        ['type', (f: Feature) => f.getFeatureDataType(), 'BOOLEAN'],
        ['enabled', (f: Feature) => f.isEnabled(), true],
        ['format', (f: Feature) => new Feature({ name: 'f', feature_id: 'f', type: 'STRING', enabled_value: 'on', disabled_value: 'off', enabled: true, segment_rules: [] }).getFeatureDataFormat(), 'TEXT'],
    ])('exposes %s', (_name, getter, expected) => expect(getter(feature())).toBe(expected));
});

describe('Property model', () => {
    const make = (type = 'BOOLEAN', value: unknown = true, format?: string) => new Property({ name: 'property', property_id: 'property', type, value, format, segment_rules: [] });
    test('exposes property details', () => {
        const property = make();
        expect(property.getPropertyName()).toBe('property');
        expect(property.getPropertyId()).toBe('property');
        expect(property.getPropertyDataType()).toBe('BOOLEAN');
        expect(property.getPropertyDataFormat()).toBeUndefined();
    });
    test('defaults string format to TEXT', () => expect(make('STRING', 'value').getPropertyDataFormat()).toBe('TEXT'));
    test('preserves JSON format', () => expect(make('STRING', {}, 'JSON').getPropertyDataFormat()).toBe('JSON'));
    test('preserves YAML format', () => expect(make('STRING', 'key: value', 'YAML').getPropertyDataFormat()).toBe('YAML'));
    test('returns the default value', () => expect(make('NUMERIC', 25).getCurrentValue('entity')).toBe(25));
    test('returns null for an invalid entity id', () => expect(make().getCurrentValue('')).toBeNull());
});

describe('FeatureSegmentRule and PropertySegmentRule', () => {
    test('reads feature segment rule fields', () => {
        const rule = new FeatureSegmentRule({ rules: [], value: '$default', order: 2, rollout_id: 'r', rollout_type: 'GUARDED', rollout_percentage: 20 });
        expect(rule.getOrder()).toBe(2);
        expect(rule.getValue()).toBe('$default');
        expect(rule.getRolloutId()).toBe('r');
        expect(rule.getRolloutType()).toBe('GUARDED');
        expect(rule.getRolloutPercentage()).toBe(20);
    });
    test('reads property segment rule fields', () => {
        const rule = new PropertySegmentRule({ rules: [], value: 'override', order: 1 });
        expect(rule.getOrder()).toBe(1);
        expect(rule.getValue()).toBe('override');
        expect(rule.getRules()).toEqual([]);
    });
});

describe('Rule operators', () => {
    const check = (operator: string, value: unknown, expected: boolean, ruleValue = 'alice') => {
        const rule = new Rule({ attribute_name: 'value', operator, values: [ruleValue] });
        expect(rule.evaluateRule({ value })).toBe(expected);
    };
    test.each([
        ['startsWith', 'alice@example.com', true], ['notStartsWith', 'bob@example.com', true],
        ['endsWith', 'alice@example.com', true], ['notEndsWith', 'alice@example.net', true],
        ['contains', 'alice@example.com', true], ['notContains', 'alice@example.com', false],
        ['is', 'alice', true], ['isNot', 'bob', true], ['greaterThan', 8, true],
        ['lesserThan', 4, true], ['greaterThanEquals', 7, true], ['lesserThanEquals', 7, true],
        ['unknown', 'alice', false],
    ])('evaluates %s', (operator, value, expected) => check(operator, value, expected, operator.toLowerCase().includes('starts') ? 'alice' : operator.toLowerCase().includes('ends') ? 'com' : operator === 'contains' || operator === 'notContains' ? '@' : operator.includes('Than') ? '7' : 'alice'));
    test('returns false for a missing attribute', () => expect(new Rule({ attribute_name: 'missing', operator: 'is', values: ['x'] }).evaluateRule({})).toBe(false));
    test('returns false for null values', () => check('is', null, false));
    test('evaluates all negative values', () => expect(new Rule({ attribute_name: 'v', operator: 'isNot', values: ['a', 'b'] }).evaluateRule({ v: 'c' })).toBe(true));
});

describe('Segment evaluation', () => {
    const evaluate = (operator: string, actual: unknown, expected: boolean, wanted = 'alice') => new Segment({ name: 's', segment_id: 's', rules: [{ attribute_name: 'v', operator, values: [wanted] }] }).evaluateRule({ v: actual });
    test.each([
        ['startsWith', 'alice-x', true], ['notStartsWith', 'bob-x', true], ['endsWith', 'x-alice', true],
        ['notEndsWith', 'x-bob', true], ['contains', 'xalicex', true], ['notContains', 'bob', true],
        ['is', 'alice', true], ['isNot', 'bob', true], ['greaterThan', 8, true], ['lesserThan', 2, true],
        ['greaterThanEquals', 7, true], ['lesserThanEquals', 7, true],
    ])('supports %s', (operator, actual, expected) => expect(evaluate(operator, actual, expected, operator.includes('Than') ? '7' : 'alice')).toBe(expected));
    test('requires every segment rule to match', () => expect(new Segment({ name: 's', segment_id: 's', rules: [{ attribute_name: 'a', operator: 'is', values: ['1'] }, { attribute_name: 'b', operator: 'is', values: ['2'] }] }).evaluateRule({ a: '1', b: '3' })).toBe(false));
    test('returns false for empty attributes', () => expect(new Segment({ name: 's', segment_id: 's', rules: [{ attribute_name: 'a', operator: 'is', values: ['1'] }] }).evaluateRule({})).toBe(false));
    test('returns true for a segment with no rules', () => expect(new Segment({ name: 's', segment_id: 's', rules: [] }).evaluateRule({})).toBe(true));
    test('handles numeric string comparison', () => expect(evaluate('is', '7', true, '7')).toBe(true));
    test('handles null attributes', () => expect(evaluate('is', null, false)).toBe(false));
    test('does not treat punctuation as wildcards', () => expect(evaluate('startsWith', 'aliceXstone', false, 'alice.stone')).toBe(false));
});

describe('model metering integration', () => {
    beforeEach(() => { setCache({}, {}, {}, {}); jest.spyOn(Metering.getInstance(), 'addMetering').mockImplementation(() => undefined); });
    afterEach(() => {
        Metering.getInstance().stop();
        jest.restoreAllMocks();
    });
    test('feature invalid entity does not throw', () => expect(feature().getCurrentValue('')).toBeNull());
    test('property evaluation does not throw', () => expect(new Property({ name: 'p', property_id: 'p', type: 'BOOLEAN', value: true, segment_rules: [] }).getCurrentValue('e')).toBe(true));
});
