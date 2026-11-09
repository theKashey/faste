import { faste } from '../src';

const machine = () =>
  faste()
    .withPhases(['a', 'b'])
    .withMessages(['go', 'hit'])
    .withSignals(['out'])
    .withState({ n: 0 })
    .withTimers({ T: 10 });

describe('a handle from an earlier run', () => {
  const restarted = () => {
    const entered = jest.fn();
    const changed = jest.fn();
    const hit = jest.fn();
    const m = machine()
      .on('@enter', (_, __, phase) => entered(phase))
      .on('@change', () => changed())
      .on('hit', () => hit())
      .on('on_T', () => hit())
      .create()
      .start('a');
    const stale = m.instance();

    m.destroy();
    m.start('a');
    entered.mockClear();

    return { m, stale, entered, changed, hit };
  };

  it('does not transition the new run', () => {
    const { m, stale, entered } = restarted();

    expect(stale.transitTo('b')).toBe(false);

    expect(m.phase()).toBe('a');
    expect(entered).not.toHaveBeenCalled();
  });

  it('does not change the state of the new run', () => {
    const { m, stale, changed } = restarted();

    stale.setState({ n: 1 });
    stale.setState(() => ({ n: 2 }));

    expect(m.instance().state.n).toBe(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not emit into the new run', () => {
    const { m, stale } = restarted();
    const observer = jest.fn();

    m.connect(observer);
    stale.emit('out');

    expect(observer).not.toHaveBeenCalled();
  });

  it('does not trigger a message in the new run', () => {
    const { stale, hit } = restarted();

    stale.trigger('hit');

    expect(hit).not.toHaveBeenCalled();
  });

  it('does not start a timer in the new run', () => {
    jest.useFakeTimers();

    const { stale, hit } = restarted();

    stale.startTimer('T');
    jest.advanceTimersByTime(100);

    expect(hit).not.toHaveBeenCalled();
  });

  it('does not stop a timer of the new run', () => {
    jest.useFakeTimers();

    const { m, stale, hit } = restarted();

    m.instance().startTimer('T');
    stale.stopTimer('T');
    jest.advanceTimersByTime(100);

    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('holds no timer that fires in the new run', () => {
    jest.useFakeTimers();

    const hit = jest.fn();
    const m = machine()
      .on('on_T', () => hit())
      .create()
      .start('a');

    m.instance().startTimer('T');
    m.destroy();
    m.start('a');
    jest.advanceTimersByTime(100);

    expect(hit).not.toHaveBeenCalled();
  });

  it('delivers no async signal into the new run', async () => {
    const observer = jest.fn();
    const m = machine()
      .withAsyncSignals()
      .on('go', ({ emit }) => emit('out'))
      .create()
      .start('a');

    m.connect(observer);
    m.put('go');
    m.destroy();
    m.start('a');
    await Promise.resolve();

    expect(observer).not.toHaveBeenCalled();
  });

  it('stays dead when a hook of the old run fires late', () => {
    const triggers: ((message: 'hit') => void)[] = [];
    const hit = jest.fn();
    const m = machine()
      .on('hit', () => hit())
      .hooks({
        hit: ({ trigger }) => {
          triggers.push(trigger);
        },
      })
      .create()
      .start('a');

    m.destroy();
    m.start('a');

    triggers[0]('hit');
    expect(hit).not.toHaveBeenCalled();

    triggers[1]('hit');
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('keeps a late rejection from the handlers of the new run', async () => {
    const trap = jest.fn();
    const log = jest.spyOn(console, 'error').mockImplementation((): void => undefined);
    let reject: (error: Error) => void;
    const pending = new Promise<void>((_, rejectIt) => {
      reject = rejectIt;
    });

    const m = machine()
      .on('go', (): Promise<void> => pending)
      .on('@error', (_, error) => trap(error))
      .create()
      .start('a');

    m.put('go');
    m.destroy();
    m.start('a');

    const failure = new Error('late');

    reject(failure);
    await pending.catch((): void => undefined);
    await Promise.resolve();
    await Promise.resolve();

    expect(trap).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
    log.mockRestore();
  });

  it('leaves the delivery of the new run working when a handler restarts the machine', () => {
    const hit = jest.fn();
    const m = machine()
      .on('go', () => {
        m.destroy();
        m.start('a');
      })
      .on('hit', () => hit())
      .create()
      .start('a');

    m.put('go');
    m.put('hit');

    expect(hit).toHaveBeenCalledTimes(1);
  });
});

describe('a destroyed machine', () => {
  it('ignores its own handles', () => {
    const m = machine().create().start('a');
    const late = m.instance();

    m.destroy();
    late.setState({ n: 1 });

    expect(m.instance().state.n).toBe(0);
  });

  it('cannot be revived by its own teardown', () => {
    const hookOn = jest.fn();
    const m = machine()
      .on('hit', ['a', 'b'], () => undefined)
      .hooks({
        hit: () => {
          hookOn();

          return ({ transitTo }: any) => transitTo('b');
        },
      })
      .create()
      .start('a');

    m.destroy();

    expect(m.phase()).toBe('a');
    expect(hookOn).toHaveBeenCalledTimes(1);
  });

  it('keeps its last phase readable', () => {
    const m = machine().create().start('b');

    m.destroy();

    expect(m.phase()).toBe('b');
  });

  it('tells its observers once', () => {
    const observer = jest.fn();
    const m = machine().create().start('a');

    m.observe(observer);
    m.destroy();
    m.destroy();

    expect(observer.mock.calls).toEqual([['@destroy']]);
  });
});

describe('start after destroy', () => {
  describe.each([
    ['the same phase', 'a'],
    ['a different phase', 'b'],
  ] as const)('into %s', (_, next) => {
    const entries = () => {
      const entered = jest.fn();
      const left = jest.fn();
      const hookOn = jest.fn();
      const hookOff = jest.fn();
      const observer = jest.fn();
      const m = machine()
        .on('@enter', (__, ___, phase) => entered(phase))
        .on('@leave', () => left())
        .on('hit', ['a', 'b'], () => undefined)
        .hooks({
          hit: () => {
            hookOn();

            return hookOff;
          },
        })
        .create();

      m.observe(observer);
      m.start('a');
      m.destroy();
      [entered, left, hookOn, hookOff, observer].forEach((spy) => spy.mockClear());
      m.start(next);

      return { m, entered, left, hookOn, hookOff, observer };
    };

    it('runs @enter', () => {
      expect(entries().entered.mock.calls).toEqual([[next]]);
    });

    it('runs no @leave', () => {
      expect(entries().left).not.toHaveBeenCalled();
    });

    it('tells the observers', () => {
      expect(entries().observer.mock.calls).toEqual([['@start'], [next]]);
    });

    it('activates a hook both phases share', () => {
      const { m, hookOn, hookOff } = entries();

      expect(hookOn).toHaveBeenCalledTimes(1);
      m.destroy();
      expect(hookOff).toHaveBeenCalledTimes(1);
    });
  });

  it('activates a hook that is not bound to a phase', () => {
    const hookOn = jest.fn();
    const m = machine()
      .on('hit', () => undefined)
      .hooks({ hit: () => hookOn() })
      .create()
      .start('a');

    m.destroy();
    hookOn.mockClear();
    m.start('a');

    expect(hookOn).toHaveBeenCalledTimes(1);
  });

  it('holds no phase until one is entered', () => {
    const m = machine().create().start('a');

    m.destroy();
    m.start();

    expect(m.phase()).toBeUndefined();
  });

  it('enters the phase @init picks, even the one it held', () => {
    const entered = jest.fn();
    const m = machine()
      .on('@init', ({ transitTo }) => transitTo('a'))
      .on('@enter', (_, __, phase) => entered(phase))
      .create()
      .start();

    m.destroy();
    entered.mockClear();
    m.start();

    expect(entered.mock.calls).toEqual([['a']]);
  });

  it('keeps the state and the connections', () => {
    const observer = jest.fn();
    const m = machine()
      .on('go', ({ setState, emit }) => {
        setState({ n: 1 });
        emit('out');
      })
      .create()
      .start('a');

    m.connect(observer);
    m.put('go');
    m.destroy();
    m.start('a');
    m.put('go');

    expect(m.instance().state.n).toBe(1);
    expect(observer).toHaveBeenCalledTimes(2);
  });
});

describe('a transition whose run ends part way', () => {
  it('turns on no hook and keeps the phase when @leave destroys the machine', () => {
    const hookOn = jest.fn();
    const m = machine()
      .on('@leave', () => {
        m.destroy();
      })
      .on('go', ['a'], ({ transitTo }) => transitTo('b'))
      .on('hit', ['b'], () => undefined)
      .hooks({ hit: () => hookOn() })
      .create()
      .start('a');

    m.put('go');

    expect(hookOn).not.toHaveBeenCalled();
    expect(m.phase()).toBe('a');
  });

  it('does not finish in the new run when @leave restarts the machine', () => {
    const entered = jest.fn();
    let restart = true;
    const m = machine()
      .on('@leave', () => {
        if (restart) {
          restart = false;
          m.destroy();
          m.start('a');
        }
      })
      .on('@enter', (_, __, phase) => entered(phase))
      .on('go', ['a'], ({ transitTo }) => transitTo('b'))
      .create()
      .start('a');

    entered.mockClear();
    m.put('go');

    expect(entered.mock.calls).toEqual([['a']]);
    expect(m.phase()).toBe('a');
  });

  it('turns on no hook when @init destroys the machine', () => {
    const hookOn = jest.fn();
    const m = machine()
      .on('@init', () => {
        m.destroy();
      })
      .on('hit', () => undefined)
      .hooks({ hit: () => hookOn() })
      .create();

    m.start();

    expect(hookOn).not.toHaveBeenCalled();
    expect(m.isStarted()).toBe(false);
  });

  it('turns off a hook that destroyed the machine as it turned on', () => {
    const hookOff = jest.fn();
    let destroy = true;
    const m = machine()
      .on('hit', () => undefined)
      .hooks({
        hit: () => {
          if (destroy) {
            destroy = false;
            m.destroy();
          }

          return hookOff;
        },
      })
      .create();

    m.start('a');
    expect(hookOff).toHaveBeenCalledTimes(1);

    m.start('a');
    expect(hookOff).toHaveBeenCalledTimes(1);
  });

  it('enters nothing when an observer destroys the machine as it starts', () => {
    const hookOn = jest.fn();
    const m = machine()
      .on('hit', ['a'], () => undefined)
      .hooks({ hit: () => hookOn() })
      .create();

    m.observe((phase) => {
      if (phase === '@start') {
        m.destroy();
      }
    });

    expect(() => m.start('a')).not.toThrow();
    expect(hookOn).not.toHaveBeenCalled();
  });
});

describe('start on a running machine', () => {
  it('ends the running run first, so every hook it turned on goes off', () => {
    const hookOn = jest.fn();
    const hookOff = jest.fn();
    const observer = jest.fn();
    const m = machine()
      .on('hit', () => undefined)
      .hooks({
        hit: () => {
          hookOn();

          return hookOff;
        },
      })
      .create()
      .start('a');

    m.observe(observer);
    m.start('a');

    expect(hookOn).toHaveBeenCalledTimes(2);
    expect(hookOff).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls).toEqual([['@destroy'], ['@start'], ['a']]);
  });

  it('leaves the delivery of the new run working when a handler starts it again', () => {
    const hit = jest.fn();
    const m = machine()
      .on('go', () => {
        m.start('a');
      })
      .on('hit', () => hit())
      .create()
      .start('a');

    m.put('go');
    m.put('hit');

    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('gives a handle or a timer of the earlier run nothing to act on', () => {
    jest.useFakeTimers();

    const hit = jest.fn();
    const m = machine()
      .on('on_T', () => hit())
      .create()
      .start('a');
    const stale = m.instance();

    stale.startTimer('T');
    m.start('a');
    stale.setState({ n: 5 });
    jest.advanceTimersByTime(100);

    expect(m.instance().state.n).toBe(0);
    expect(hit).not.toHaveBeenCalled();
  });
});
