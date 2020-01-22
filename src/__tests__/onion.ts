import { pipe } from 'fp-ts/lib/pipeable';

import * as Onion_ from '../onion';
import { Prepend, Zero } from '../onion';

describe('context', () => {
  it('prepend', () => {
    const context: Prepend<number, Prepend<'foo', Zero>> = pipe(
      Onion_.zero,
      Onion_.prepend<'foo'>('foo'),
      Onion_.prepend(123),
    );
    expect(context).toMatchObject([123, ['foo', []]]);
  });
});
