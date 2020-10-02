import { Task } from 'fp-ts/lib/Task';
import { ReaderTask } from 'fp-ts/lib/ReaderTask';
import * as Object_ from '../utils/object';
import { Tuple } from '../utils/tuple';

export type Handler<I, O, C extends Context<any>, W extends Workspace<any>> = (
  i: I,
  c: C,
  w: W,
) => Task<O>;

export type API<A extends { [p: string]: Handler<any, any, any, any> }> = A;

export type Processor<
  I,
  O,
  C extends Context<any>,
  W extends Workspace<any>,
  A extends API<any>
> = (i: I) => (c: C, w: W) => ReaderTask<A, O>;

export type ProcessorInstance<I, O> = (i: I) => Task<O>;

export type Context<C extends Tuple<any>> = C;

export type Workspace<W extends Object_.Object> = W;
