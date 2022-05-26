const defaultCacheKeyBuilder = (...args: any[]): string =>
  args.length === 0 ? "__0aritykey__" : JSON.stringify(args);

const isPromise = <TResult>(
  value: unknown,
): value is Promise<TResult> => value instanceof Promise;

export interface GenericCache<TKey = void, TValue = void> {
  has: (k: TKey) => boolean | Promise<boolean>;
  get: (k: TKey) => TValue | undefined;
  set: (k: TKey, v: TValue) => void;
  delete: (k: TKey) => boolean;
  clear?: () => void;
}

export interface CacheWithTimer<TKey = void, TValue = void>
  extends Omit<GenericCache<TKey, TValue>, "set"> {
  set: (k: TKey, v: TValue, exp: number) => void;
}

export interface MemoizyOptions<
  TArgs extends any[] = unknown[],
  TResult = unknown,
  TCacheKey = string,
> {
  /**
   * A factory that returns a map like cache
   */
  cache?: () =>
    | GenericCache<TCacheKey, TResult>
    | CacheWithTimer<TCacheKey, TResult>;
  /**
   * Time, in milliseconds, to retain the result of the memoization
   */
  maxAge?: number;
  /**
   * A function to return the memoization key given the arguments of the function
   */
  cacheKey?: (...args: TArgs) => TCacheKey;
  /**
   *  A function that, given the result, returns a boolean to keep it or not.
   */
  valueAccept?:
    | null
    | ((err: Error | null, res?: TResult) => boolean);
  /**
   * If true the expiration is handled at cache level. In that case `set` takes three parameters and
   * the last is the expiration time in milliseconds. Useful for redis caches
   */
  cacheHandlesExpiration?: boolean;
}

export interface MemoizedFunction<TResult, TArgs extends any[]> {
  (...args: TArgs): TResult | Promise<TResult>;
  delete: (...args: TArgs) => boolean;
  clear: () => void;
}

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
 * @param [config.cacheHandlesExpiration] If true, expiration mechanism is left to the cache itself
 */
export const memoizy = <
  TResult,
  TArgs extends any[],
  TCacheKey = string,
>(
  fn: (...args: TArgs) => TResult | Promise<TResult>,
  opt?: MemoizyOptions<TArgs, TResult, TCacheKey>,
): MemoizedFunction<TResult, TArgs> => {
  const {
    cache: cacheFactory = () => new Map<TCacheKey, TResult>(),
    cacheKey = defaultCacheKeyBuilder,
    maxAge = Infinity,
    valueAccept = null,
    cacheHandlesExpiration = false,
  } = opt || {};
  const hasExpireDate = maxAge > 0 && maxAge < Infinity;
  const cache = cacheFactory();

  const set = (key: TCacheKey, value: TResult) => {
    if (cacheHandlesExpiration && hasExpireDate) {
      cache.set(key, value, maxAge);
    } else {
      if (hasExpireDate) {
        setTimeout(() => {
          cache.delete(key);
        }, maxAge);
      }
      (cache as GenericCache<TCacheKey, TResult>).set(key, value);
    }
  };

  const onExistenceChecked = (
    exists: boolean,
    key: TCacheKey,
    args: TArgs,
  ) => {
    if (exists) {
      return cache.get(key) as TResult;
    }
    const value = fn(...args);

    if (!valueAccept) {
      set(key, value as TResult);
    } else if (isPromise<TResult>(value)) {
      value
        .then((res) => [null, res])
        .catch((err) => [err])
        .then(([err, res]) => {
          if (valueAccept(err, res)) {
            set(key, res);
          }
        });
    } else if (valueAccept(null, value)) {
      set(key, value);
    }

    return value;
  };

  const memoized = (...args: TArgs) => {
    const key = cacheKey(...args) as TCacheKey;
    const existence = cache.has(key);
    if (isPromise(existence)) {
      return existence.then((exists) => onExistenceChecked(exists, key, args));
    } else {
      return onExistenceChecked(existence, key, args);
    }
  };

  memoized.delete = (...args: TArgs) =>
    cache.delete(cacheKey(...args) as TCacheKey);
  memoized.clear = () => {
    if (cache.clear instanceof Function) {
      cache.clear();
    } else {
      throw new Error("This cache doesn't support clear");
    }
  };

  return memoized;
};
