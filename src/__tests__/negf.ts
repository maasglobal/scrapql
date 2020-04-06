import { pipe } from 'fp-ts/lib/pipeable';

import * as NEGenF_ from '../negf';
import { NEGenF } from '../negf';

describe('NEGenF', () => {
  it('fromGF', () => {
    const gen: NEGenF<'a' | 'b' | 'c'> = NEGenF_.fromGF(function* () {
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
    const numbers: NEGenF<number> = NEGenF_.fromGF(function* () {
      yield 1;
      yield 2;
      yield 3;
    });
    const even = pipe(
      numbers,
      NEGenF_.map((x) => 2 * x),
    );
    const handle = even();
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 4, done: false });
    expect(handle.next()).toStrictEqual({ value: 6, done: true });
  });

  it('take', () => {
    const numbers: NEGenF<number> = NEGenF_.fromGF(function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
      yield 6;
    });
    const oneTwoThree = pipe(numbers, NEGenF_.take(3));
    const handle = oneTwoThree();
    expect(handle.next()).toStrictEqual({ value: 1, done: false });
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 3, done: true });
  });

  it('take too many', () => {
    const numbers: NEGenF<number> = NEGenF_.fromGF(function* () {
      yield 1;
      yield 2;
      yield 3;
    });
    const allThree = pipe(numbers, NEGenF_.take(10));
    const handle = allThree();
    expect(handle.next()).toStrictEqual({ value: 1, done: false });
    expect(handle.next()).toStrictEqual({ value: 2, done: false });
    expect(handle.next()).toStrictEqual({ value: 3, done: true });
  });

  it('sequenceT1', () => {
    type AB = 'a' | 'b';
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type One = [NEGenF<AB>];
    const separate: One = [ab];
    const combined: NEGenF<[AB]> = pipe(NEGenF_.sequenceT(...separate));
    const handle = combined();
    expect(handle.next()).toStrictEqual({ value: ['a'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b'], done: true });
  });
  it('sequenceT2', () => {
    type AB = 'a' | 'b';
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NEGenF<CD> = NEGenF_.neGenF(['c', 'd']);
    type Two = [NEGenF<AB>, NEGenF<CD>];
    const separate: Two = [ab, cd];
    const combined: NEGenF<[AB, CD]> = pipe(NEGenF_.sequenceT(...separate));
    const handle = combined();
    expect(handle.next()).toStrictEqual({ value: ['a', 'c'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['a', 'd'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'c'], done: false });
    expect(handle.next()).toStrictEqual({ value: ['b', 'd'], done: true });
  });
  it('sequenceT3', () => {
    type AB = 'a' | 'b';
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NEGenF<CD> = NEGenF_.neGenF(['c', 'd']);
    type EF = 'e' | 'f';
    const ef: NEGenF<EF> = NEGenF_.neGenF(['e', 'f']);
    type Three = [NEGenF<AB>, NEGenF<CD>, NEGenF<EF>];
    const separate: Three = [ab, cd, ef];
    const combined: NEGenF<[AB, CD, EF]> = pipe(NEGenF_.sequenceT(...separate));
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
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type One = {
      ab: NEGenF<AB>;
    };
    const separate: One = { ab };
    const combined: NEGenF<{ ab: AB }> = NEGenF_.sequenceS(separate);
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
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NEGenF<CD> = NEGenF_.neGenF(['c', 'd']);
    type Two = {
      ab: NEGenF<AB>;
      cd: NEGenF<CD>;
    };
    const separate: Two = { ab, cd };
    const combined: NEGenF<{ ab: AB; cd: CD }> = NEGenF_.sequenceS(separate);
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
    const ab: NEGenF<AB> = NEGenF_.neGenF(['a', 'b']);
    type CD = 'c' | 'd';
    const cd: NEGenF<CD> = NEGenF_.neGenF(['c', 'd']);
    type EF = 'e' | 'f';
    const ef: NEGenF<EF> = NEGenF_.neGenF(['e', 'f']);
    type Three = {
      ab: NEGenF<AB>;
      cd: NEGenF<CD>;
      ef: NEGenF<EF>;
    };
    const separate: Three = { ab, cd, ef };
    const combined: NEGenF<{ ab: AB; cd: CD; ef: EF }> = NEGenF_.sequenceS(separate);
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
