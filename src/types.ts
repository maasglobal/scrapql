import { Task } from 'fp-ts/lib/Task';

// all processors share these generic processor types

export type Context = Array<string>;

export type QueryProcessor<Q, R> = (q: Q) => Task<R>;
export type ResultProcessor<R> = (r: R) => Task<void>;

export type Build<P, A, C extends Context> = (a: A) => (c: C) => P;
