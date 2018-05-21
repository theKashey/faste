import {faste} from "../src";

describe('Faste attrs', () => {
  it('bi-dirrectional light control', () => {
    const light = faste()
      .withPhases(['red', 'yellow', 'green'])
      .withMessages(['tick'])
      .withState({direction: null})
      .withAttrs({direction: 1})

      .on('@init', ({setState, attrs}) => setState({direction: attrs.direction}))

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

    light.attrs({direction:1})
    light.start('yellow');

    expect(light.phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('green');

    light.attrs({direction:0})
    light.start('yellow');

    expect(light.phase()).toBe('yellow');
    expect(light.put('tick').phase()).toBe('red');
  })
});