export type STATE_CHANGE = '@change';
export type ENTER_LEAVE = '@enter' | '@leave';
export type MAGIC_EVENTS = '@init' | '@miss' | '@guard' | '@error' | STATE_CHANGE | ENTER_LEAVE;
export type MAGIC_PHASES = '@current' | '@busy' | '@locked';
