import { faste } from '../src';

describe('machine lifecycle', () => {
  const machine = (onInit: () => void) =>
    faste()
      .withPhases(['a', 'b'])
      .on('@init', () => onInit())
      .create();

  it('does not come back to life from a late transition', () => {
    const onInit = jest.fn();
    const m = machine(onInit).start('a');
    const late = m.instance();

    m.destroy();
    expect(late.transitTo('b')).toBe(false);

    expect(m.isStarted()).toBe(false);
    expect(m.phase()).toBe('a');
    expect(onInit).toHaveBeenCalledTimes(1);
  });

  it('restarts through start', () => {
    const onInit = jest.fn();
    const m = machine(onInit).start('a');

    m.destroy();
    m.start('b');

    expect(m.isStarted()).toBe(true);
    expect(m.phase()).toBe('b');
    expect(onInit).toHaveBeenCalledTimes(2);
  });

  it('starts in the phase it already holds', () => {
    const onInit = jest.fn();
    const m = machine(onInit).start('a');

    m.destroy();
    m.start('a');

    expect(m.isStarted()).toBe(true);
    expect(onInit).toHaveBeenCalledTimes(2);
  });

  it('delivers no async signal after destroy', async () => {
    const observer = jest.fn();
    const m = faste()
      .withMessages(['go'])
      .withSignals(['out'])
      .withAsyncSignals()
      .on('go', ({ emit }) => emit('out'))
      .create()
      .start();

    m.connect(observer);
    m.put('go');
    m.destroy();
    await Promise.resolve();

    expect(observer).not.toHaveBeenCalled();
  });
});

describe('message queue', () => {
  it('keeps working after a handler throws', () => {
    const tick = jest.fn();
    const m = faste()
      .withMessages(['boom', 'tick'])
      .on('boom', () => {
        throw new Error('boom');
      })
      .on('tick', () => tick())
      .create()
      .start();

    expect(() => m.put('boom')).toThrow('boom');
    m.put('tick');

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('delivers what a failing handler queued', () => {
    const tick = jest.fn();
    const m = faste()
      .withMessages(['boom', 'tick'])
      .on('boom', ({ trigger }) => {
        trigger('tick');
        throw new Error('boom');
      })
      .on('tick', () => tick())
      .create()
      .start();

    expect(() => m.put('boom')).toThrow('boom');

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('holds queued messages while busy', async () => {
    const tick = jest.fn();
    let release: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const m = faste()
      .withPhases(['idle'])
      .withMessages(['go', 'block', 'tick'])
      .on('go', ({ trigger }) => {
        trigger('block');
        trigger('tick');
      })
      .on('block', async ({ transitTo }) => {
        transitTo('@busy');
        held.then(() => transitTo('@current'));
      })
      .on('tick', () => tick())
      .create()
      .start('idle');

    m.put('go');
    expect(m.phase()).toBe('@busy');
    expect(tick).not.toHaveBeenCalled();

    release();
    await held;
    await Promise.resolve();

    expect(m.phase()).toBe('idle');
    expect(tick).toHaveBeenCalledTimes(1);
  });
});

describe('thenable handlers', () => {
  it('accepts a thenable without catch', () => {
    const m = faste()
      .withMessages(['go'])
      .on('go', () => ({ then: (resolve: () => void) => resolve() }) as any)
      .create()
      .start();

    expect(() => m.put('go')).not.toThrow();
  });

  it('routes a thenable rejection to @error', async () => {
    const trap = jest.fn();
    const m = faste()
      .withMessages(['go'])
      .on('go', () => ({ then: (_: unknown, reject: (e: Error) => void) => reject(new Error('no')) }) as any)
      .on('@error', (_, error) => trap(error))
      .create()
      .start();

    m.put('go');
    await new Promise((resolve) => setTimeout(resolve));

    expect(trap).toHaveBeenCalledWith(new Error('no'));
  });
});

describe('builder', () => {
  it('keeps async signals through later builder calls', () => {
    const observer = jest.fn();
    const m = faste()
      .withAsyncSignals()
      .withMessages(['go'])
      .withSignals(['out'])
      .on('go', ({ emit }) => emit('out'))
      .create()
      .start();

    m.connect(observer);
    m.put('go');

    expect(observer).not.toHaveBeenCalled();
  });

  it('gives each variant its own handlers, hooks and guards', () => {
    const handler = jest.fn();
    const hook = jest.fn();
    const guard = jest.fn(() => false);
    const base = faste().withPhases(['a', 'b']).withMessages(['go']);

    base
      .withState({ n: 1 })
      .on('go', () => handler())
      .hooks({ go: () => hook() })
      .guard(['b'], guard);

    const other = base
      .withState({ n: 2 })
      .on('go', ({ transitTo }) => transitTo('b'))
      .create()
      .start('a');

    other.put('go');

    expect(handler).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
    expect(guard).not.toHaveBeenCalled();
    expect(other.phase()).toBe('b');
  });

  it('carries what was declared before a variant', () => {
    const handler = jest.fn();
    const m = faste()
      .withMessages(['go'])
      .on('go', () => handler())
      .withState({ n: 1 })
      .create()
      .start();

    m.put('go');

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('phase events', () => {
  it('passes the phases in the order the signatures name', () => {
    const enter = jest.fn();
    const leave = jest.fn();
    const m = faste()
      .withPhases(['a', 'b'])
      .withMessages(['go'])
      .on('go', ({ transitTo }) => transitTo('b'))
      .on('@enter', ['b'], (_, ...phases) => enter(...phases))
      .on('@leave', ['a'], (_, ...phases) => leave(...phases))
      .create()
      .start('a');

    m.put('go');

    expect(enter).toHaveBeenCalledWith('a', 'b');
    expect(leave).toHaveBeenCalledWith('b', 'a');
  });
});
