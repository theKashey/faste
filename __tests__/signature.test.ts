import { faste } from '../src';

describe('signatures', () => {
  it('messages', () => {
    faste()
      .withMessages(['tick', 'tock', 'test'])
      .withMessageArguments<{
        tick: [arg: { x: number }];
      }>()
      .on('tick', ({ trigger }, arg) => {
        console.log(
          arg.x,
          // @ts-expect-error
          arg.y
        );
      })
      .on('@init', ({ trigger }) => {
        // @ts-expect-error
        trigger('tick');
        // @ts-expect-error
        trigger('undefined');
        // @ts-expect-error
        trigger('tick', '1');
        // @ts-expect-error
        trigger('tick', 1, 2);
        // @ts-expect-error
        trigger('tock', 1, 2);

        trigger('tock');
        trigger('tick', { x: 1 });
      });

    expect(1).toBe(1);
  });

  it('signals', () => {
    faste()
      .withSignals(['tick', 'tock'])
      .withSignalArguments<{
        tick: [arg: { x: number }];
      }>()
      .on('@init', ({ emit }) => {
        // @ts-expect-error
        emit('tick');
        // @ts-expect-error
        emit('undefined');
        // @ts-expect-error
        emit('tick', '1');
        // @ts-expect-error
        emit('tick', 1, 2);
        // @ts-expect-error
        emit('tock', 1, 2);

        emit('tock');
        emit('tick', { x: 1 });
      });

    expect(1).toBe(1);
  });

  describe('default', () => {
    it('life cycle', () => {
      faste()
        .withMessages(['tick'])
        .withMessageArguments<{
          tick: [arg: number];
        }>()
        .on('@leave', (_, oldPhase) => {
          // @ts-expect-error
          oldPhase.startsWith('xx');
        });

      faste()
        .withMessages(['tick'])
        .withPhases(['some', 'another'])
        .withMessageArguments<{
          tick: [arg: number];
        }>()
        .on('@leave', (_, oldPhase, newPhase) => {
          oldPhase.startsWith('xx');
          newPhase.startsWith('xx');
        })
        .on('@enter', (_, oldPhase) => {
          oldPhase.startsWith('xx');
        })
        .on('@error', (_, error) => {
          error.stack;
          // @ts-expect-error
          error.x;
        });
    });

    it('state', () => {
      faste()
        .on('@change', (_) => {
          // nope
        })
        .on('@change', (_, oldState) => {
          // @ts-expect-error
          oldState.x;
        });

      faste()
        .withState({ x: 1 })
        .on('@change', (_) => {
          // nope
        })
        .on('@change', (_, oldState) => {
          oldState.x;
        });
    });

    it('connect', () => {
      const machine1 = faste()
        .withMessages(['in', 'out', 'sig-1', 'sig-2', 'sig-5'])
        .withMessageArguments<{
          'sig-2': [number];
        }>()
        .withSignals(['sig-1', 'sig-2', 'sig-5', 'sig-6'])
        .withSignalArguments<{
          'sig-1': [string];
          'sig-5': [Date];
        }>()
        .create();

      machine1.connect((event, ...args) => {
        switch (event) {
          case 'sig-1':
            const [string] = machine1.castSignalArgument(event, ...args);
            string.startsWith('x');
          case 'sig-2':
            // @ts-expect-error
            const [any] = machine1.castSignalArgument(event, ...args);
        }
      });

      // @ts-expect-error
      machine1.connect(machine1);

      machine1.connect<'sig-1'>(machine1);
      machine1.connect<'sig-2'>(machine1);
      machine1.connect<'sig-5'>(machine1);

      faste()
        .withState({ x: 1 })
        .on('@change', (_) => {
          // nope
        })
        .on('@change', (_, oldState) => {
          oldState.x;
        });
    });
  });
});
