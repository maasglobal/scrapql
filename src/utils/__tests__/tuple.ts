import { pipe } from 'fp-ts/lib/pipeable';

import * as Tuple_ from '../tuple';

describe('tuple', () => {
  it('prepend', () => {
    const context: Tuple_.Prepend<number, Tuple_.Prepend<'foo', Tuple_.Tuple<[]>>> = pipe(
      Tuple_.tuple(),
      Tuple_.prepend<'foo'>('foo'),
      Tuple_.prepend(123),
    );
    expect(context).toMatchObject([123, 'foo']);
  });
});
