type CollectionLike = {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): void;
};

type CollectionPrototype = Record<string, unknown>;

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

installGetOrInsertComputed(Map.prototype as unknown as CollectionPrototype);
installGetOrInsertComputed(WeakMap.prototype as unknown as CollectionPrototype);