import { validator } from 'io-ts-validator';

import {
  client,
  Err,
  exampleQuery,
  exampleResult,
  Query,
  Response,
  Result,
  RPC,
  server,
  wireQueryProcessor,
} from '../readme';

const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
  /* intentionally empty */
});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
  /* intentionally empty */
});

describe('readme', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('wireQueryProcessor', () => {
    it('should process serialized query', async () => {
      const wireQuery = validator(Query, 'json').encodeSync(exampleQuery);
      const wireResult: string = await wireQueryProcessor(wireQuery);
      const result = validator(Result, 'json').decodeSync(wireResult);
      expect(result).toStrictEqual(exampleResult);
    });
  });

  describe('server', () => {
    it('should send error response on invalid query', async () => {
      const rawResult = await server('{ "protocol": null }');

      expect(errorSpy).toHaveBeenCalled();

      const result = validator(Response(Err, Result), 'json').decodeSync(rawResult);

      expect(result).toMatchObject({ _tag: 'Left' });
    });
  });

  describe('client', () => {
    it('should work', async () => {
      await client(exampleQuery);
      expect(logSpy.mock.calls).toEqual([
        ['Success!'],
        ['c002', 'known customer'],
        [
          'c002',
          {
            age: 35,
            name: 'Magica De Spell',
          },
        ],
        ['c007', 'unknown customer'],
        [
          '2018',
          {
            profit: 100,
          },
        ],
        [
          '3030',
          {
            profit: 0,
          },
        ],
      ]);
    });

    it('should fail', async () => {
      const rpcCrash = new Error('Unable to reach server');
      const clientErr: Err = [String(rpcCrash)];
      const clientCrash = new Error(JSON.stringify(clientErr));

      const rpc: RPC = async () => {
        throw rpcCrash;
      };

      const promise = client(exampleQuery, rpc);
      expect(promise).rejects.toStrictEqual(clientCrash);
    });
  });
});
