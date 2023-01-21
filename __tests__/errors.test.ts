import { faste } from '../src';

describe('Faste error handling', () => {
  const machineFactory = () =>
    faste().on('@init', () => {
      throw new Error('error');
    });

  const asyncMachineFactory = () =>
    faste().on('@init', () =>
      Promise.resolve().then(() => {
        throw new Error('error');
      })
    );

  it('throws if unprotected', () => {
    expect(() => {
      machineFactory().create().start();
    }).toThrow();
  });

  it('handles error', () => {
    const trap = jest.fn();
    const machine = machineFactory().on('@error', (_, error) => {
      trap(error);
    });

    expect(() => {
      machine.create().start();
    }).not.toThrow();

    expect(trap).toHaveBeenCalledWith(expect.any(Error));
  });

  describe('async', () => {
    it.only('does not handles async error', async () => {
      const trap = jest.fn();
      const machine = asyncMachineFactory().on('@error', (_, error) => {
        trap(error);
      });

      expect(() => {
        machine.create().start();
      }).not.toThrow();

      expect(trap).not.toHaveBeenCalled();

      await 1;
      await 1;

      expect(trap).toHaveBeenCalled();
    });
  });
});
