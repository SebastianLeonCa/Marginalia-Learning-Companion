type CollectionLike = {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): void;
};

type CollectionPrototype = Record<string, unknown>;

function installReadableStreamAsyncIterator() {
  if (typeof ReadableStream === "undefined" || typeof Symbol.asyncIterator === "undefined") {
    return;
  }

  const prototype = ReadableStream.prototype as ReadableStream<unknown> & {
    [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
  };
  if (typeof prototype[Symbol.asyncIterator] === "function") return;

  Object.defineProperty(prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: function (this: ReadableStream<unknown>) {
      const reader = this.getReader();
      return {
        next: () => reader.read(),
        return: async () => {
          reader.releaseLock();
          return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  });
}

function installPromiseWithResolvers() {
  const promiseConstructor = Promise as typeof Promise & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof promiseConstructor.withResolvers === "function") return;

  Object.defineProperty(promiseConstructor, "withResolvers", {
    configurable: true,
    writable: true,
    value: <T>() => {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
      });
      return { promise, resolve, reject };
    },
  });
}

function installGetOrInsertComputed(prototype: CollectionPrototype) {
  if (typeof prototype.getOrInsertComputed === "function") return;

  Object.defineProperty(prototype, "getOrInsertComputed", {
    configurable: true,
    writable: true,
    value: function (
      this: CollectionLike,
      key: unknown,
      callback: (key: unknown) => unknown,
    ) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    },
  });
}

installReadableStreamAsyncIterator();
installPromiseWithResolvers();
installGetOrInsertComputed(Map.prototype as unknown as CollectionPrototype);
installGetOrInsertComputed(WeakMap.prototype as unknown as CollectionPrototype);