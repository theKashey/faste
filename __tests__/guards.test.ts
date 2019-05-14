import {faste} from "../src";

describe('Faste guards', () => {
  it('guards to red', () => {
    const light = faste()
      .withPhases(['red', 'green'])
      .withMessages(['tick'])
      .withState(({count: 0}))
      .on('tick', ['green'], ({transitTo, setState}) => {
        setState(s => ({count: s.count + 1}));
        transitTo('red')
      })
      .on('tick', ['red'], ({transitTo}) => transitTo('green'))
      .guard(['red'], ({state}) => state.count > 2)

      .create();

    light.start('green');

    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
  });

  it('guards to green', () => {
    const light = faste()
      .withPhases(['red', 'green'])
      .withMessages(['tick'])
      .withState(({count: 0}))
      .on('tick', ['green'], ({transitTo, setState}) => {
        setState(s => ({count: s.count + 1}));
        transitTo('red')
      })
      .on('tick', ['red'], ({transitTo}) => transitTo('green'))
      .guard(['green'], ({state}) => state.count > 2)

      .create();

    expect(() => light.start('green')).toThrow();
  });

  it('guards to green from red', () => {
    const light = faste()
      .withPhases(['red', 'green'])
      .withMessages(['tick'])
      .withState(({count: 0}))
      .on('tick', ['green'], ({transitTo, setState}) => {
        setState(s => ({count: s.count + 1}));
        transitTo('red')
      })
      .on('tick', ['red'], ({transitTo}) => transitTo('green'))
      .guard(['green'], ({state}) => state.count > 2)

      .create();

    light.start('red');
  });

  it('trap to green', () => {
    const light = faste()
      .withPhases(['red', 'green'])
      .withMessages(['tick'])
      .withState(({count: 0}))
      .on('tick', ['green'], ({transitTo, setState}) => {
        setState(s => ({count: s.count + 1}));
        transitTo('red')
      })
      .on('tick', ['red'], ({transitTo}) => transitTo('green'))
      .trap(['green'], ({state}) => state.count > 2)

      .create();

    light.start('green');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
  })
});