const defaultCacheKeyBuilder = (...args: any[]): string =>
  args.length === 0 ? "__0aritykey__" : JSON.stringify(args);

const isPromise = <TResult>(value: unknown): value is Promise<TResult> =>
  value instanceof Promise;

export interface GenericCache<TKey = void, TValue = void> {
  has: (k: TKey) => boolean;
  get: (k: TKey) => TValue | undefined;
  set: (k: TKey, v: TValue) => void;
  delete: (k: TKey) => boolean;
  clear?: () => void;
}

export interface MemoizyOptions<TResult = any> {
  cache?: () => GenericCache<string, TResult>;
  maxAge?: number;
  cacheKey?: (...args: any[]) => string;
  valueAccept?: null | ((err: Error | null, res?: TResult) => boolean);
}

export interface MemoizedFunction<TResult> {
  (...args: any[]): TResult;
  delete: (...args: any[]) => boolean;
  clear: () => void;
}

const defaultOptions = {
  cache: () => new Map(),
  maxAge: Infinity,
  cacheKey: defaultCacheKeyBuilder,
  valueAccept: null,
};

/**
 * Givent a function returns the memoized version of it
 * @example
 * const add = (a, b) => a + b;
 * const memAdd = memoizy(add);
 * const res = memAdd(4, 5);
 * 
 * @param fn The function to be memoized
 * @param [config] The config for the memoization process. All the config are optional
 * @param [config.cache] A factory that returns a map like cache
 * @param [config.maxAge] Time, in milliseconds, to retain the result of the memoization
 * @param [config.cacheKey] A function to return the memoization key given the arguments of the function
 * @param [config.valueAccept] A function that, given the result, returns a boolean to keep it or not.
 */
export const memoizy = <TResult>(
  fn: (...args: any[]) => TResult,
  {
    cache: cacheFactory = () => new Map<string, TResult>(),
    maxAge = Infinity,
    cacheKey = defaultCacheKeyBuilder,
    valueAccept = null,
  } = defaultOptions as MemoizyOptions<TResult>,
): MemoizedFunction<TResult> => {
  const hasExpireDate = maxAge > 0 && maxAge < Infinity;
  const cache = cacheFactory();

  const set = (key: string, value: TResult) => {
    if (hasExpireDate) {
      setTimeout(() => {
        cache.delete(key);
      }, maxAge);
    }
    cache.set(key, value);
  };

  const memoized = (...args: any[]) => {
    const key = cacheKey(...args);
    if (cache.has(key)) {
      return cache.get(key) as TResult;
    }
    const value = fn(...args);

    if (!valueAccept) {
      set(key, value);
    } else if (isPromise<TResult>(value)) {
      value
        .then((res) => [null, res])
        .catch((err) => [err])
        .then(([err, res]) => {
          if (valueAccept(err, res)) {
            set(key, value);
          }
        });
    } else if (valueAccept(null, value)) {
      set(key, value);
    }

    return value;
  };

  memoized.delete = (...args: any[]) => cache.delete(cacheKey(...args));
  memoized.clear = () => {
    if (cache.clear instanceof Function) {
      cache.clear();
    } else {
      throw new Error("This cache doesn't support clear");
    }
  };

  return memoized;
};

export default memoizy;
