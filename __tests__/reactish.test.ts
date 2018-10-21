import {faste} from "../src";

describe('Faste react', () => {
  it('react interface', () => {

    class Component {

      onEvent = (event: Event) => machine.put(event.type, event);

      render() {
        //return <div onClick={this.onEvent} />
      }
    }
  })

})