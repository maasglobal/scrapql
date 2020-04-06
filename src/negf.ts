import { pipe } from 'fp-ts/lib/pipeable';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import * as NonEmptyArray_ from 'fp-ts/lib/NonEmptyArray';

/* eslint-disable fp/no-let, fp/no-loops, fp/no-mutation, fp/no-throw */

export type NEGenFResult<A> = IteratorResult<A, A>;

export type NEGenF<A> = () => Generator<A, A, undefined>;
export function neGenF<A>(nea: NonEmptyArray<A>): NEGenF<A> {
  return function* () {
    for (const a of NonEmptyArray_.init(nea)) {
      yield a;
    }
    return NonEmptyArray_.last(nea);
  };
}

export function toNEArray<A>(gen: NEGenF<A>): NonEmptyArray<A> {
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

export function fromGF<A>(gf: () => Generator<A, void, undefined>): NEGenF<A> {
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
  return function <A>(gen: NEGenF<A>): NEGenF<A> {
    return fromGF(function* () {
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
  return function (gen: NEGenF<A>): NEGenF<B> {
    return fromGF(function* () {
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

export function sequenceT<I extends NonEmptyArray<NEGenF<any>>>(
  ...generators: I
): NEGenF<{ [K in keyof I]: I[K] extends NEGenF<infer A> ? A : never }> {
  return fromGF(function* () {
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

export function sequenceS<O extends Record<string, NEGenF<any>>>(
  generators: {
    [I in keyof O]: O[I];
  },
): NEGenF<{ [I in keyof O]: O[I] extends NEGenF<infer A> ? A : never }> {
  return fromGF(function* () {
    const [[firstKey, firstGen], ...more] = Object.entries(generators);
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
