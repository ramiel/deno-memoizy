# Memoizy

Note: Looking for the node version? Check [memoizy](https://github.com/ramiel/memoizy)

[Deno](https://deno.land) library that let you memoize your functions and also have the following features:

- ⏰ Max age: discard memoized value after a configurable amount of time 
- ♻️ Custom cache: drop-in your favorite cache or your own implementation
- 🗝 Custom cache key: decide how to build the cache keys
- 🧹 Clear and delete: delete all the memoized values or just one for a specific arguments set 
- ❓ Conditional memoization: memoize the result only if you like it. It works with async code too
- 🧪 Fully tested
- 👶 Small size and no dependencies
- 👣 Small footprint
- &nbsp;**λ**&nbsp;&nbsp; FP style available

## Usage

### Basic

Memoize the return value of a function

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

const fact = (n) => {
  if(n === 1) return n;
  return n * fact(n - 1);
}

const memoizedFact = memoizy(fact);
memoizedFact(3); // 6
memoizedFact(3); // the return value is always 6 but
                 // the factorial is not computed anymore
```

## API

The memoize function is defined like that:

`memoizy(fn, options)`

where `fn` is the function to memoize    
and `options` is an (optional) object with the following keys:

- `maxAge`: Tell how much time the value must be kept in memory, in milliseconds. 0 or negative values mean forever. Default: Infinity
- `cache`: Specify a different cache to be used. It's a function that returns a new cache that must have the same interface as [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Default `() => new Map()`
- `cacheKey`: Function to build the cache key given the arguments.
- `valueAccept`: Function in the form `(err, value) => true/false`. It receive an error (if any) and the memoized value and return true/false. If false is returned, the value is discarded. If the memoized function returns a promise, the resolved value (or the rejection error) is passed to the function. Default null (all values accepted)

`memoizy` return the memoized function with two other properties: `delete` and `clear`

- `delete`: is a function that takes the same arguments as the original function and delete the entry for those arguments
- `clear`: is a function that deletes all the cached entries

## Recipes

### Expire data

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

const double = memoizy(a => a * 2, {maxAge: 2000});

double(2); // 4
double(2); // returns memoized 4
// wait 2 seconds, memoized value has been discarded
double(2); // Original function is called again and 4 is returned. The value is memoized for other 2 seconds
```

### Discard rejected promises

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

const originalFn = async (a) => {
  if(a > 10) return 100;
  throw new Error('Value must be more then 10');
}
const memoized = memoizy(originalFn, {valueAccept: (err, value) => !err});

await memoized(1); // throw an error and the value is not memoized
await memoized(15); // returns 100 and the value is memoized
```


### Discard some values

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

const originalFn = (a) => {
  if(a > 10) return true;
  return false;
}
// Tell to ignore the false value returned
const memoized = memoizy(originalFn, {valueAccept: (err, value) => value === true});

await memoized(1); // ignores the result since it's false
await memoized(15); // returns true and it's memoized
```

### Delete and Clear

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

const sum = (a, b) => a + b;

const memSum = memoizy(sum);

memSum(5, 4); // returns 9;
memSum(1, 3); // returns 4;
memSum.delete(5,4); // remove the entry for the memoized result 9
memSum(1, 3); // returns 4 without comupting the sum
memSum(5, 4); // returns 9 re-computing the sum and memoize it again

memSum.clear(); // All values are now cleared and 
                // the cache for this memoized function is empty
```

### Different cache

You can use another cache implementation if you desire. The only constraint is that it must implement
the methods `has`, `get`, `set`, `delete` and, optionally, `clear`.    
If the cache doesn't support clear, it's up to you not to call it. In case an error is thrown.

**NOTE**: If you plan to use a WeakMap, remember that clear is not available in all the implementations.    
Look [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap#Implementing_a_WeakMap-like_class_with_a_.clear()_method) for a way to use a weak map with clear implementd, as cache.

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';

 const AlternativeCacheFactory = () => {
  let data = {};
  return {
    has(key) { return key in data; },
    get(key) { return data[key]; },
    set(key, value) { data[key] = value; },
    delete(key) { delete data[key]; },
    clear() { data = {}; },
  };
};
const fn = a => a * 2;
const memFn = memoizy(fn, {cache: AlternativeCacheFactory});
```

## Use WeakMap as cache

Let's see how to use a WeakMap, without implementing the optional clear.

```js
const fn = jest.fn(obj => ({ ...obj, date: new Date() }));
const memFn = memoizy(fn, {
  // Specify a cache factory that returns a new WeakMap
  cache: () => new WeakMap(), 
  // A WeakMap only accept non-primitive values as key.
  // Let's change the way the key is created
  // In this case just return the first parameter. 
  // Note that this works for weakMap caches only
  cacheKey: obj => obj
});
```

## Use Redis (or any cache that can handle data expiration)

Your cache may have the ability to handle expiration by itself, for example Redis can do it.
In this case you don't want memoizy to handle expiration internally just because it's more performant
to let Redis do the job. You can specify `cacheHandlesExpiration = true` in the options. 
The only difference is that the cache you provide must expect the expiration time in milliseconds 
as third parameter of the `set` method. Here below an example with redis

```js
import { memoizy } from 'https://deno.land/x/memoizy/mod.ts';
import { connect } from "https://deno.land/x/redis@v0.25.5/mod.ts";
const redis = await connect({
  // ...redis options
});

const redisCache = {
  get: redis.get.bind(redis),
  clear: redis.flushdb.bind(redis),
  delete: redis.del.bind(redis),
  set: (key, value, expiration) => {
    if(expiration) {
      return redis.set(key, value, {px: expiration});
    } else {
      return redis.set(key, value);
    }
  }
};
/**
 * Function memoized with redis must return a promise because 
 * redis lookup is asynchronous by nature
 **/
const fn = async (a,b) => a * b;

const memoizedMultiplyOnRedis = memoizy(fn, {
  maxAge: 5000,
  cache: () => redisCache,
  cacheHandlesExpiration: true,
})
```

## FP style alternative

This library offers a variant which is handy if you develop in functional programming style.

It has the same features and the following differences:
- the order of the parameters is inverted `memoizy(options, fn)`
- the `memoizy` function is curried

An example

```js
import { fp as memoizy } from 'https://deno.land/x/memoizy/fp.ts';

// since it is curried, we can pass just options and a new function will be returned
const memoizeFor5Seconds = memoizy({maxage: 5 * 1000});

const double = a => a * 2;
const triple = a => a * 3;

// Now we can memoize both functions with the same options
const memoizedDouble = memoizeFor5Seconds(double);
const memoizedTriple = memoizeFor5Seconds(triple);
```
