import { Build } from './types';
import * as query from './query';
import * as result from './result';

export function init<P, A>(builder: Build<P, A, []>, api: A): P {
  return builder(api)([]);
}

export const process = {
  query,
  result,
};
