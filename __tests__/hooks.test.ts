import { faste } from '../src';

describe('Faste hooks', () => {
  it('simple light control', () => {
    let tockHandler: (a: any) => void = undefined;

    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick', 'tock'])

      .on('tick', ['red'], ({ transitTo }) => transitTo('yellow'))
      .on('tick', ['yellow'], ({ transitTo }) => transitTo('green'))
      .on('tock', ['yellow'], ({ transitTo }) => transitTo('green'))
      .on('tick', ['green'], ({ transitTo }) => transitTo('red'))

      .hooks({
        tock: (st) => {
          if (st.message === 'tock') {
            tockHandler = st.trigger;
          }

          return (st) => {
            if (st.message === 'tock') {
              tockHandler = undefined;
            }
          };
        },
      })
      .create();

    light.start('red');

    expect(light.phase()).toBe('red');
    expect(tockHandler).not.toBeDefined();
    expect(light.put('tick').phase()).toBe('yellow');

    expect(tockHandler).toBeDefined();
    tockHandler!('tick');
    expect(light.phase()).toBe('green');
    expect(tockHandler).not.toBeDefined();

    expect(light.put('tick').phase()).toBe('red');
  });

  it('simple light control', () => {
    let tockHandler = false;

    const light = faste()
      .withMessages(['tick', 'tock'])
      .withPhases(['green', 'red', 'yellow'])
      .on('@enter', ['red'], ({ transitTo }) => transitTo('yellow'))
      .on('tock', ['yellow'], ({ transitTo }) => transitTo('green'))

      .hooks({
        tock: () => {
          tockHandler = true;

          return () => {
            tockHandler = false;
          };
        },
      })

      .create();

    light.start('red');

    expect(tockHandler).toBeTruthy();
    light.destroy();
    expect(tockHandler).toBeFalsy();
  });
});
