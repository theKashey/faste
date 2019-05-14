import {faste} from "../src";

describe('Faste simple', () => {
  it('simple light control', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])

      .on('tick', ['red'], ({transitTo}) => transitTo('yellow'))
      .on('tick', ['yellow'], ({transitTo}) => transitTo('green'))
      .on('tick', ['green'], ({transitTo}) => transitTo('red'))

      .create();

    light.start('red');

    expect(light.phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
  });

  it('bi-dirrectional light control', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])
      .withState({direction: 1})

      .on('tick', ['red'], ({transitTo, setState}) => {
        setState({direction: 1});
        transitTo('yellow')
      })
      .on('tick', ['yellow'], ({transitTo, state}) => transitTo(state.direction ? 'green' : 'red'))
      .on('tick', ['green'], ({transitTo, setState}) => {
        setState({direction: 0});
        transitTo('yellow')
      })

      .create();

    light.start('red');

    expect(light.phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('green');
  })

  it('simple light control @init', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])

      .on('tick', ['red'], ({transitTo}) => transitTo('yellow'))
      .on('tick', ['yellow'], ({transitTo}) => transitTo('green'))
      .on('tick', ['green'], ({transitTo}) => transitTo('red'))
      .on('@init', ({transitTo}) => transitTo('red'))

      .create();

    light.start();

    expect(light.phase()).toBe('red');
    expect(light.put('tick').phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('green');
    expect(light.put('tick').phase()).toBe('red');
  });

  it('simple light control autochange', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])

      .on('@enter', ['red'], ({transitTo}) => transitTo('yellow'))
      .on('@enter', ['yellow'], ({transitTo}) => transitTo('green'))
      //.on('@enter', ['green'], ({transitTo}) => transitTo('red'))

      .create();

    light.start('red');

    expect(light.phase()).toBe('green');
  });

  it('simple light control self-trigger', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])

      .on('@enter', ['red'], ({trigger}) => trigger('tick'))
      .on('@enter', ['yellow'], ({trigger}) => trigger('tick'))

      .on('tick', ['red'], ({transitTo}) => transitTo('yellow'))
      .on('tick', ['yellow'], ({transitTo}) => transitTo('green'))
      .on('tick', ['green'], ({transitTo}) => transitTo('red'))

      .create();

    light.start('red');

    expect(light.phase()).toBe('green');
  });

  it('external light control', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])

      .on('tick', ['red'], ({transitTo}) => transitTo('yellow'))
      .on('tick', ['yellow'], ({transitTo}) => transitTo('green'))
      .on('tick', ['green'], ({transitTo}) => transitTo('red'))

      .create();

    const control = faste()
      .withMessages(['tock'])

      .on('tock', ({emit}) => emit('tick'))

      .create()
      .start();

    control.connect(light);

    light.start('red');

    expect(light.phase()).toBe('red');
    control.put('tock');
    expect(light.phase()).toBe('yellow');
    control.put('tock');
    expect(light.phase()).toBe('green');
    control.put('tock');
    expect(light.phase()).toBe('red');
  });
});