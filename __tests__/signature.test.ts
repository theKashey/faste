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
          oldPhase.startsWith('xx');
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
  });
});
