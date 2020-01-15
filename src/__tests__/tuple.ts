import { pipe } from 'fp-ts/lib/pipeable';

import * as Context_ from '../tuple';
import { Prepend, Zero } from '../tuple';

describe('context', () => {
  it('prepend', () => {
    const context: Prepend<number, Prepend<'foo', Zero>> = pipe(
      Context_.zero,
      Context_.prepend<'foo'>('foo'),
      Context_.prepend(123),
    );
    expect(context).toMatchObject([123, ['foo', []]]);
  });
});
