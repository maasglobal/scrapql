import { Task } from 'fp-ts/lib/Task';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import { Onion, Zero } from '../utils/onion';

export type Handler<I, O, C extends Context, W extends Workspace<any>> = (
  i: I,
  c: C,
  w: W,
) => Task<O>;

export type API<A extends { [p: string]: Handler<any, any, any, any> }> = A;

export type Processor<
  I,
  O,
  C extends Context,
  W extends Workspace<any>,
  A extends API<any>
> = (i: I) => (c: C, w: W) => ReaderTask<A, O>;

export type ProcessorInstance<I, O> = (i: I) => Task<O>;

// TODO: with TS4 tuple type Context<C extends Array<any>> = C
export type Context = Onion<any, any> | Zero;

export type Workspace<W extends object> = W;
