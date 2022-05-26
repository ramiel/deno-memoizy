import { memoizy, MemoizyOptions, MemoizedFunction } from './mod.ts';

const curry: any = (fn: Function, ...args: unknown[]) =>
  args.length >= fn.length
    ? fn(...args)
    : curry.bind(null, fn, ...args);

const curried = curry(
  <TResult, TArgs extends any[]>(
    options: MemoizyOptions<TArgs, TResult>,
    fn: (...args: unknown[]) => TResult,
  ) => memoizy(fn, options),
);

export function fp<TResult, TArgs extends any[]>(
  options: MemoizyOptions<TArgs, TResult>,
  fn: (...args: TArgs) => TResult,
): MemoizedFunction<TResult, TArgs>;
export function fp<TArgs extends any[]>(
  options: MemoizyOptions<TArgs>,
): <TResult>(
  fn: (...args: TArgs) => TResult,
) => MemoizedFunction<TResult, TArgs>;
export function fp<TArgs extends any[]>(...args: TArgs) {
  return curried(...args);
}
