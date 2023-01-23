export const callListeners = <T extends any[]>(listeners: ((...args: T) => void)[], ...args: T) =>
  listeners.forEach((listener) => listener(...args));

export const invokeAsync = (cb: () => void) => {
  Promise.resolve().then(cb);
};
