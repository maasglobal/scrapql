import { pipe } from 'fp-ts/lib/pipeable';

import * as NonEmptyList_ from '../non-empty-list';
import { NonEmptyList } from '../non-empty-list';

describe('NonEmptyList', () => {
  it('fromGenerator', () => {
    const gen: NonEmptyList<'a' | 'b' | 'c'> = NonEmptyList_.fromGenerator(function* () {
      yield 'a';
      yield 'b';
      yield 'c';
    });
    const handle = gen();
    expect(handle.next()).toStrictEqual({ value: 'a', done: false });
    expect(handle.next()).toStrictEqual({ value: 'b', done: false });
    expect(handle.next()).toStrictEqual({ value: 'c', done: true });
  });

  it('map', () => {
    const numbers: NonEmptyList<number> = NonEmptyList_.fromGenerator(function* () {
      yield 1;
      yield 2;
      yield 3;
    });
    const even = pipe(
      numbers,
      NonEmptyList_.map((x) => 2 * x),
    );
    const handle = even();
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 4, done: false });
    expect(handle.next()).toStrictEqual({ value: 6, done: true });
  });

  it('take', () => {
    const numbers: NonEmptyList<number> = NonEmptyList_.fromGenerator(function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
      yield 6;
    });
    const oneTwoThree = pipe(numbers, NonEmptyList_.take(3));
    const handle = oneTwoThree();
    expect(handle.next()).toStrictEqual({ value: 1, done: false });
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 3, done: true });
  });

  it('take too many', () => {
    const numbers: NonEmptyList<number> = NonEmptyList_.fromGenerator(function* () {
      yield 1;
      yield 2;
      yield 3;
    });
    const allThree = pipe(numbers, NonEmptyList_.take(10));
    const handle = allThree();
    expect(handle.next()).toStrictEqual({ value: 1, done: false });
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 3, done: true });
  });

  it('head', () => {
    const fooBar: NonEmptyList<'foo' | 'bar'> = NonEmptyList_.fromGenerator(function* () {
      yield 'foo';
      yield 'bar';
    });
    expect(NonEmptyList_.head(fooBar)).toStrictEqual('foo');
  });

  it('sequenceT1', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type One = [NonEmptyList<AB>];
    const separate: One = [ab];
    const combined: NonEmptyList<[AB]> = pipe(NonEmptyList_.sequenceT(...separate));
    const handle = combined();
    expect(handle.next()).toStrictEqual({ value: ['a'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b'], done: true });
  });
  it('sequenceT2', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NonEmptyList<CD> = NonEmptyList_.nonEmptyList(['c', 'd']);
    type Two = [NonEmptyList<AB>, NonEmptyList<CD>];
    const separate: Two = [ab, cd];
    const combined: NonEmptyList<[AB, CD]> = pipe(NonEmptyList_.sequenceT(...separate));
    const handle = combined();
    expect(handle.next()).toStrictEqual({ value: ['a', 'c'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['a', 'd'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'c'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'd'], done: true });
  });
  it('sequenceT3', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NonEmptyList<CD> = NonEmptyList_.nonEmptyList(['c', 'd']);
    type EF = 'e' | 'f';
    const ef: NonEmptyList<EF> = NonEmptyList_.nonEmptyList(['e', 'f']);
    type Three = [NonEmptyList<AB>, NonEmptyList<CD>, NonEmptyList<EF>];
    const separate: Three = [ab, cd, ef];
    const combined: NonEmptyList<[AB, CD, EF]> = pipe(
      NonEmptyList_.sequenceT(...separate),
    );
    const handle = combined();
    expect(handle.next()).toStrictEqual({ value: ['a', 'c', 'e'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['a', 'c', 'f'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['a', 'd', 'e'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['a', 'd', 'f'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'c', 'e'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'c', 'f'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'd', 'e'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'd', 'f'], done: true });
  });

  it('sequenceS1', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type One = {
      ab: NonEmptyList<AB>;
    };
    const separate: One = { ab };
    const combined: NonEmptyList<{ ab: AB }> = NonEmptyList_.sequenceS(separate);
    const handle = combined();
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b' },
      done: true,
    });
  });
  it('sequenceS2', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NonEmptyList<CD> = NonEmptyList_.nonEmptyList(['c', 'd']);
    type Two = {
      ab: NonEmptyList<AB>;
      cd: NonEmptyList<CD>;
    };
    const separate: Two = { ab, cd };
    const combined: NonEmptyList<{ ab: AB; cd: CD }> = NonEmptyList_.sequenceS(separate);
    const handle = combined();
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'c' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'd' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'c' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'd' },
      done: true,
    });
  });
  it('sequenceS3', () => {
    type AB = 'a' | 'b';
    const ab: NonEmptyList<AB> = NonEmptyList_.nonEmptyList(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NonEmptyList<CD> = NonEmptyList_.nonEmptyList(['c', 'd']);
    type EF = 'e' | 'f';
    const ef: NonEmptyList<EF> = NonEmptyList_.nonEmptyList(['e', 'f']);
    type Three = {
      ab: NonEmptyList<AB>;
      cd: NonEmptyList<CD>;
      ef: NonEmptyList<EF>;
    };
    const separate: Three = { ab, cd, ef };
    const combined: NonEmptyList<{ ab: AB; cd: CD; ef: EF }> = NonEmptyList_.sequenceS(
      separate,
    );
    const handle = combined();
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'c', ef: 'e' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'c', ef: 'f' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'd', ef: 'e' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'a', cd: 'd', ef: 'f' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'c', ef: 'e' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'c', ef: 'f' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'd', ef: 'e' },
      done: false,
    });
    expect(handle.next()).toStrictEqual({
      value: { ab: 'b', cd: 'd', ef: 'f' },
      done: true,
    });
  });
});
