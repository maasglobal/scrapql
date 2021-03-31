import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';
import { pipe } from 'fp-ts/lib/pipeable';

/* eslint-disable fp/no-let, fp/no-loops, fp/no-mutation, fp/no-throw */

export type NonEmptyList<A> = () => Generator<A, A, undefined>;
export function nonEmptyList<A>(nea: NonEmptyArray<A>): NonEmptyList<A> {
  return function* () {
    for (const a of NonEmptyArray_.init(nea)) {
      yield a;
    }
    return NonEmptyArray_.last(nea);
  };
}

export function toNonEmptyArray<A>(gen: NonEmptyList<A>): NonEmptyArray<A> {
  const handle = gen();
  const init = [];
  let last;
  while (true) {
    const { done, value } = handle.next();
    if (done) {
      last = value;
      break;
    } else {
      init.push(value);
    }
  }
  return NonEmptyArray_.snoc(init, last);
}

export function head<A>(gen: NonEmptyList<A>): A {
  const handle = gen();
  const { value } = handle.next();
  return value;
}

export function fromGenerator<A>(
  gf: () => Generator<A, void, undefined>,
): NonEmptyList<A> {
  return function* (): Generator<A, A, undefined> {
    const handle = gf();
    const first = handle.next();
    if (first.done) {
      throw new Error('Empty generator');
    }
    let previous = first;
    while (true) {
      const current = handle.next();
      if (current.done) {
        return previous.value;
      }
      yield previous.value;
      previous = current;
    }
  };
}

export function take(limit: number) {
  return function <A>(gen: NonEmptyList<A>): NonEmptyList<A> {
    return fromGenerator(function* () {
      const handle = gen();
      let i = 0;
      while (i < limit) {
        const { done, value } = handle.next();
        yield value;
        if (done) {
          break;
        }
        i += 1;
      }
    });
  };
}

export function map<A, B>(f: (a: A) => B) {
  return function (gen: NonEmptyList<A>): NonEmptyList<B> {
    return fromGenerator(function* () {
      const handle = gen();
      while (true) {
        const { done, value } = handle.next();
        yield f(value);
        if (done) {
          break;
        }
      }
    });
  };
}

export function sequenceT<I extends NonEmptyArray<NonEmptyList<any>>>(
  ...generators: I
): NonEmptyList<{ [K in keyof I]: I[K] extends NonEmptyList<infer A> ? A : never }> {
  return fromGenerator(function* () {
    const [first, ...more] = generators;
    if (more.length === 0) {
      const handle = first();
      while (true) {
        const { done, value: head } = handle.next();
        yield [head] as any;
        if (done) {
          return;
        }
      }
    }
    const tails = sequenceT(...(more as any));

    const handle = first();
    while (true) {
      const { done: doneHeads, value: head } = handle.next();
      const combos = pipe(
        tails,
        map((tail) => [head, ...(tail as any)]),
      ) as any;
      const comboHandle = combos();
      while (true) {
        const { done: doneCombos, value: combo } = comboHandle.next();
        yield combo as any;
        if (doneCombos) {
          break;
        }
      }
      if (doneHeads) {
        break;
      }
    }
  });
}

export function sequenceS<O extends Record<string, NonEmptyList<any>>>(
  generators: {
    [I in keyof O]: O[I];
  },
): NonEmptyList<{ [I in keyof O]: O[I] extends NonEmptyList<infer A> ? A : never }> {
  return fromGenerator(function* () {
    const [first, ...more] = Object.entries(generators);
    if (typeof first === 'undefined') {
      yield {};
      return;
    }
    const [firstKey, firstGen] = first;
    if (more.length === 0) {
      const handle = firstGen();
      while (true) {
        const { done, value: head } = handle.next();
        yield Object.fromEntries([[firstKey, head]]) as any;
        if (done) {
          return;
        }
      }
    }
    const tails: any = sequenceS(Object.fromEntries(more) as any);

    const handle = firstGen();
    while (true) {
      const { done: doneHeads, value: head } = handle.next();
      const combos = pipe(
        tails,
        map((tail) =>
          Object.fromEntries([[firstKey, head], ...Object.entries(tail as any)]),
        ),
      ) as any;
      const comboHandle = combos();
      while (true) {
        const { done: doneCombos, value: combo } = comboHandle.next();
        yield combo as any;
        if (doneCombos) {
          break;
        }
      }
      if (doneHeads) {
        break;
      }
    }
  }) as any;
}
