import { Prepend, Concat, Reverse } from 'typescript-tuple';
import * as Tuple_ from '../tuple';

describe('tuple', () => {
  type Pair = [string, number];

  it('prepend', () => {
    const foo: Pair = ['one', 2];
    const result: Prepend<Pair, number> = Tuple_.prepend(0)(foo);
    expect(result).toMatchObject([0, 'one', 2]);
  });

  it('concat', () => {
    const foo: Pair = ['one', 2];
    const bar: Pair = ['three', 4];
    const result: Concat<Pair, Pair> = Tuple_.concat(bar)(foo);
    expect(result).toMatchObject(['one', 2, 'three', 4]);
  });

  it('reverse', () => {
    const foo: Pair = ['foo', 123];
    const result: Reverse<Pair> = Tuple_.reverse(foo);
    expect(result).toMatchObject([123, 'foo']);
  });
});
