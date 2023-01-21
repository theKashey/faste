export const callListeners = <T extends any[]>(listeners: ((...args: T) => void)[], ...args: T) =>
  listeners.forEach((listener) => listener(...args));
