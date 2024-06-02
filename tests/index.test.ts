import { hello } from '../src/index';

test('says hello', () => {
    expect(hello()).toBe('Hello World');
});