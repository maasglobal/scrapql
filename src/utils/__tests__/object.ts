import { mergeObject } from '../object';

describe('object', () => {
  it('mergeObject', () => {
    const foo = 123 as const;
    const bar = 456 as const;
    const quux = 789 as const;

    const a = { foo, bar };
    const b = { quux };

    const ab = mergeObject(a, b);

    expect(ab).toMatchObject({ foo, bar, quux });
  });
});
