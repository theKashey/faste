export type debugCallback = (instance: any, event: string, ...args: any[]) => any;

let debugFlag: boolean | debugCallback = false;

export const debug = (instance: any, event: string, ...args: any[]) => {
  if (debugFlag) {
    if (typeof debugFlag === 'function') {
      debugFlag(instance, event, ...args);
    } else {
      console.debug('Faste:', instance.name ? instance.name : instance, event, ...args);
    }
  }
};

/**
 * enabled debug
 * @param flag
 */
export const setFasteDebug = (flag: debugCallback | boolean) => (debugFlag = flag);
