import { faste } from '../src';

describe('Faste busy', () => {
  it('busy flow', () => {
    const uncertainty = faste()
      .withMessages(['tick', 'observe'])
      .withPhases(['idle'])
      .withState({ counter: 0 })
      .withMessageArguments<{
        observe: [observer: Promise<void>];
      }>()
      .on('tick', ({ setState, state }) => setState({ counter: state.counter + 1 }))
      .on('observe', async ({ transitTo }, observer) => {
        transitTo('@busy');

        observer.then(() => {
          transitTo('@current');
        });
      })

      .create()
      .start('idle');

    expect(uncertainty.put('tick').instance().state.counter).toBe(1);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);

    let pResolve: () => void;
    const p = new Promise<void>((resolve) => {
      pResolve = resolve;
    });
    uncertainty.put('observe', p);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);

    pResolve();

    return p.then(() => {
      expect(uncertainty.put('tick').instance().state.counter).toBe(5);
      expect(uncertainty.put('tick').instance().state.counter).toBe(6);
    });
  });

  it('locked flow', () => {
    const uncertainty = faste()
      .withMessages(['tick', 'observe'])
      .withState({ counter: 0 })
      .withPhases(['idle'])
      .withMessageArguments<{
        observe: [observer: Promise<void>];
      }>()
      .on('tick', ({ setState, state }) => setState({ counter: state.counter + 1 }))
      .on('observe', async ({ transitTo }, observer) => {
        transitTo('@locked');
        observer.then(() => transitTo('@current'));
      })

      .create()
      .start('idle');

    expect(uncertainty.put('tick').instance().state.counter).toBe(1);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);

    let pResolve: () => void;
    const p = new Promise<void>((resolve) => {
      pResolve = resolve;
    });
    uncertainty.put('observe', p);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);
    expect(uncertainty.put('tick').instance().state.counter).toBe(2);

    pResolve();

    return p.then(() => {
      expect(uncertainty.put('tick').instance().state.counter).toBe(3);
      expect(uncertainty.put('tick').instance().state.counter).toBe(4);
    });
  });
});
