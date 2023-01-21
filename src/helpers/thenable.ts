export const isThenable = (result: any | Promise<any>): result is Promise<unknown> =>
  result && typeof result === 'object' && 'then' in result;
