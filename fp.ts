import memoizy, { MemoizyOptions, MemoizedFunction } from "./mod.ts";

const curry: any = (fn: Function, ...args: any[]) =>
  args.length >= fn.length ? fn(...args) : curry.bind(null, fn, ...args);

const curried = curry(<TResult>(options: MemoizyOptions<TResult>, fn: (...args: any[]) => TResult) => memoizy(fn, options))

function fpmemoizy<TResult>( options: MemoizyOptions<TResult>, fn: (...args: any[]) => TResult ) : MemoizedFunction<TResult>;
function fpmemoizy(options: MemoizyOptions): (<TResult>(fn: (...args: any[]) => TResult) => MemoizedFunction<TResult>);
function fpmemoizy(...args: any[]) {
  return curried(...args);
}

export default fpmemoizy;
