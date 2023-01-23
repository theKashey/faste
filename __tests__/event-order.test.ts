import { faste } from '../src';

describe('Faste order', () => {
  it('trigger', () => {
    const order: number[] = [];
    const machine = faste()
      .withMessages(['1', '2', '3'])
      .on('@init', ({ trigger }) => {
        trigger('1');
        trigger('2');
      })
      .on('1', ({ trigger }) => {
        order.push(1);
        trigger('3');
      })
      .on('2', ({ trigger }) => {
        order.push(2);
      })
      .on('3', ({ trigger }) => {
        order.push(3);
      });
    machine.create().start();
    expect(order).toEqual([1, 2, 3]);
  });

  describe('emit', () => {
    const factory = () =>
      faste()
        .withMessages(['ping'])
        .withSignals(['pong'])
        .on('ping', ({ emit }) => {
          emit('pong');
        });

    it('sync', () => {
      const trap = jest.fn();
      const instance = factory().create();
      instance.connect(trap);
      instance.put('ping');

      expect(trap).toHaveBeenCalledWith('pong');
    });

    it('async', async () => {
      const trap = jest.fn();
      const instance = factory().withAsyncSignals().create();
      instance.connect(trap);
      instance.put('ping');

      expect(trap).not.toHaveBeenCalled();
      await 1;
      expect(trap).toHaveBeenCalledWith('pong');
    });
  });
});
