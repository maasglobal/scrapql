import { Task } from 'fp-ts/lib/Task';
import { Option } from 'fp-ts/lib/Option';
import * as Option_ from 'fp-ts/lib/Option';

import { name, version } from '../../package.json';

import * as scrapqlResult from '../result';
import { ResultProcessorFactory } from '../result';

interface Logger<R, A extends Array<any>> {
  (...a: A): R;
  mock: any;
}
interface LoggerTask<R, A extends Array<any>> {
  (...a: A): Task<R>;
  mock: any;
}

function loggerTask<R, A extends Array<any>>(logger: Logger<R, A>): LoggerTask<R, A> {
  const lt: LoggerTask<R, A> = (...largs) => () => {
    return Promise.resolve(logger(...largs));
  };
  // eslint-disable-next-line fp/no-mutation
  lt.mock = logger.mock;
  return lt;
}

describe('result', () => {
  interface Reporters {
    learnProperty1Existence: (...largs: any) => Task<void>;
    receiveKeyResult: (...largs: any) => Task<void>;
    receiveProperty2Result: (...largs: any) => Task<void>;
  }

  function createReporters(): Reporters {
    return {
      learnProperty1Existence: loggerTask(jest.fn((...largs: any) => undefined)),
      receiveKeyResult: loggerTask(jest.fn((...largs: any) => undefined)),
      receiveProperty2Result: loggerTask(jest.fn((...largs: any) => undefined)),
    };
  }

  type RPF<R> = ResultProcessorFactory<Reporters, R>;

  const RESULT = `${name}/${version}/scrapql/test/result`;

  type Id = string;
  type Key = string;

  type KeyResult = string;
  const key1Result: KeyResult = 'result1';
  const processKey: RPF<KeyResult> = scrapqlResult.leaf((r) => r.receiveKeyResult);

  it('processKey', async () => {
    const reporters = createReporters();
    const main = processKey(reporters)(key1Result);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([[key1Result]]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type KeysResult = Record<Key, KeyResult>;
  const keysResult: KeysResult = {
    key1: key1Result,
  };
  const processKeys: RPF<KeysResult> = scrapqlResult.keys(processKey);

  it('processKeys', async () => {
    const reporters = createReporters();
    const main = processKeys(reporters)(keysResult);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [key1Result, 'key1'],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property1Result = Record<Id, Option<KeysResult>>;
  const property1Result: Property1Result = {
    id1: Option_.some(keysResult),
    id2: Option_.none,
  };
  const processProperty1: RPF<Property1Result> = scrapqlResult.ids(
    (r) => r.learnProperty1Existence,
    processKeys,
  );

  it('processProperty1', async () => {
    const reporters = createReporters();
    const main = processProperty1(reporters)(property1Result);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      ['id1', true],
      ['id2', false],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [key1Result, 'key1', 'id1'],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  type Property2Result = string;
  const property2Result: Property2Result = 'result2';
  const processProperty2: RPF<Property2Result> = scrapqlResult.leaf(
    (r) => r.receiveProperty2Result,
  );

  it('processProperty2', async () => {
    const reporters = createReporters();
    const main = processProperty2(reporters)(property2Result);
    await main();
    expect((reporters.learnProperty1Existence as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([
      [property2Result],
    ]);
  });

  type RootResult = Partial<{
    protocol: typeof RESULT;
    property1: Property1Result;
    property2: Property2Result;
  }>;
  const rootResult: RootResult = {
    protocol: RESULT,
    property1: property1Result,
  };

  it('processRoot (composed)', async () => {
    const processRoot: RPF<RootResult> = scrapqlResult.properties<Reporters, RootResult>({
      protocol: scrapqlResult.literal(),
      property1: processProperty1,
      property2: processProperty2,
    });
    const reporters = createReporters();
    const main = processRoot(reporters)(rootResult);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      ['id1', true],
      ['id2', false],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [key1Result, 'key1', 'id1'],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });

  it('processRoot (standalone)', async () => {
    const processRoot = scrapqlResult.properties<Reporters, RootResult>({
      protocol: scrapqlResult.literal(),
      property1: scrapqlResult.ids(
        (r: Reporters) => r.learnProperty1Existence,
        scrapqlResult.keys(scrapqlResult.leaf((r: Reporters) => r.receiveKeyResult)),
      ),
      property2: scrapqlResult.leaf((r: Reporters) => r.receiveProperty2Result),
    });
    const reporters = createReporters();
    const main = processRoot(reporters)(rootResult);
    await main();
    // eslint-disable-next-line fp/no-mutating-methods
    expect((reporters.learnProperty1Existence as any).mock.calls.sort()).toMatchObject([
      ['id1', true],
      ['id2', false],
    ]);
    expect((reporters.receiveKeyResult as any).mock.calls).toMatchObject([
      [key1Result, 'key1', 'id1'],
    ]);
    expect((reporters.receiveProperty2Result as any).mock.calls).toMatchObject([]);
  });
});
