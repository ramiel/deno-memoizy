const defaultCacheKeyBuilder = (...args: unknown[]): string =>
  args.length === 0 ? "__0aritykey__" : JSON.stringify(args);

const isPromise = <TResult>(value: unknown): value is Promise<TResult> =>
  value instanceof Promise;

interface GenericMap<TKey, TValue> {
  has: (k: TKey) => boolean;
  get: (k: TKey) => TValue | undefined;
  set: (k: TKey, v: TValue) => void;
  delete: (k: TKey) => boolean;
  clear?: () => void;
}

interface MemoizyOptions<TResult> {
  cache?: () => GenericMap<string, TResult>;
  maxAge?: number;
  cacheKey?: (...args: [unknown]) => string;
  valueAccept?: null | ((err: Error | null, res?: TResult) => boolean);
}

interface MemoizedFunction<TResult> {
  (...args: [unknown]): TResult | undefined;
  delete: (...args: [unknown]) => boolean;
  clear: () => void;
}

const defaultOptions = {
  cache: () => new Map(),
  maxAge: Infinity,
  cacheKey: defaultCacheKeyBuilder,
  valueAccept: null,
};

const memoizy = <TResult>(
  fn: (...args: [unknown]) => TResult,
  {
    cache: cacheFactory = () => new Map<string, TResult>(),
    maxAge = Infinity,
    cacheKey = defaultCacheKeyBuilder,
    valueAccept = null,
  } = defaultOptions as MemoizyOptions<TResult>
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

  const memoized = (...args: [unknown]) => {
    const key = cacheKey(...args);
    if (cache.has(key)) {
      return cache.get(key);
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

  memoized.delete = (...args: [unknown]) => cache.delete(cacheKey(...args));
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
