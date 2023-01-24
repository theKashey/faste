import { faste } from '../src';

describe('Faste timers', () => {
  it('simple light control', () => {
    jest.useFakeTimers();

    const timerCalled = jest.fn();

    const machine = faste()
      .withTimers({
        T0: 10,
      })
      .on('on_T0', () => timerCalled())
      // @ts-expect-error
      .on('on_TWrong', () => {
        // do nothing
      })
      .hooks({
        on_T0: ({ startTimer }) => {
          startTimer('T0');
        },
      });

    machine.create().start();

    expect(timerCalled).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(timerCalled).toHaveBeenCalled();
  });

  it('lifecycle', () => {
    jest.useFakeTimers();

    const timerCalled = jest.fn();

    const machine = faste()
      .withTimers({
        T0: 10,
      })
      .on('on_T0', ({ startTimer }) => {
        timerCalled();
        startTimer('T0');
      })
      .hooks({
        on_T0: ({ startTimer }) => {
          startTimer('T0');
        },
      });

    const instance = machine.create().start();

    expect(timerCalled).not.toHaveBeenCalled();
    jest.advanceTimersByTime(15);
    expect(timerCalled).toHaveBeenCalledTimes(1);
    instance.destroy();
    jest.advanceTimersByTime(100);
    expect(timerCalled).toHaveBeenCalledTimes(1);
  });
});
