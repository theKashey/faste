import { faste } from '../src';

const machine = () => faste().withPhases(['a', 'b']).withMessages(['go', 'hit']);

describe('queue and destroy', () => {
  it('drops what a handler queued before destroying the machine', () => {
    const hit = jest.fn();
    const m = machine()
      .on('go', ({ trigger }) => {
        trigger('hit');
        m.destroy();
      })
      .on('hit', () => hit())
      .create()
      .start('a');

    m.put('go');

    expect(hit).not.toHaveBeenCalled();
  });

  it('stops at the handler that destroyed the machine', () => {
    const second = jest.fn();
    const m = machine()
      .on('go', () => {
        m.destroy();
      })
      .on('go', () => second())
      .create()
      .start('a');

    m.put('go');

    expect(second).not.toHaveBeenCalled();
  });

  it('stops draining when a queued handler destroys the machine', () => {
    const hit = jest.fn();
    const m = machine()
      .on('go', ({ trigger }) => {
        trigger('hit');
        trigger('hit');
      })
      .on('hit', () => {
        hit();
        m.destroy();
      })
      .create()
      .start('a');

    m.put('go');

    expect(hit).toHaveBeenCalledTimes(1);
  });
});

describe('queue and restart', () => {
  it('leaves the new run its own queue when a queued handler restarts the machine', () => {
    const hit = jest.fn();
    const m = machine()
      .on('go', ({ trigger }) => {
        trigger('hit');
      })
      .on('hit', () => {
        hit();

        if (hit.mock.calls.length === 1) {
          m.destroy();
          m.start('a');
        }
      })
      .create()
      .start('a');

    m.put('go');
    m.put('hit');

    expect(hit).toHaveBeenCalledTimes(2);
  });
});

describe('queue failures', () => {
  const failing = () => {
    const after = jest.fn();
    const m = faste()
      .withMessages(['primary', 'clean', 'queued', 'after'])
      .on('primary', ({ trigger }) => {
        trigger('queued');
        trigger('after');
        throw new Error('primary');
      })
      .on('clean', ({ trigger }) => {
        trigger('queued');
        trigger('after');
      })
      .on('queued', () => {
        throw new Error('queued');
      })
      .on('after', () => after())
      .create()
      .start();

    return { m, after };
  };

  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'error').mockImplementation((): void => undefined);
  });

  afterEach(() => log.mockRestore());

  it('throws the primary exception, not the queued one', () => {
    expect(() => failing().m.put('primary')).toThrow('primary');
  });

  it('logs the queued failure the primary exception displaced', () => {
    expect(() => failing().m.put('primary')).toThrow();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: 'queued' }));
  });

  it('delivers the rest of the queue past a queued failure', () => {
    const { m, after } = failing();

    expect(() => m.put('primary')).toThrow();

    expect(after).toHaveBeenCalledTimes(1);
  });

  it('throws a queued failure when nothing failed before it', () => {
    const { m, after } = failing();

    expect(() => m.put('clean')).toThrow('queued');

    expect(log).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
  });
});
