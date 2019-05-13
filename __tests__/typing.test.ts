import {faste} from "../src";

describe('Faste typing', () => {

  const light = faste()
    .withPhases(['red', 'yellow', 'green'])
    .withTransitions({
      green: ['yellow'],
      yellow: ['red'],
      red: ['green'],
    })
    .withMessages(['tick', 'tock'])
    .on('tick', ['green'], ({transitTo}) => transitTo('yellow'))
    .on('tick', ['green'], ({transitTo}) => transitTo('red'))


  //t.

});
