export type Zero = Array<never>;
export const zero: Zero = [];

export type Prepend<N, C extends Zero | Prepend<any, any>> = [N, C];
export const prepend = <N>(n: N) => <C extends Zero | Prepend<any, any>>(
  c: C,
): Prepend<N, C> => [n, c];

export type Onion<N, C extends Onion<any, any>> = Zero | Prepend<N, C>;

export {};
