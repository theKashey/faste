import { faste } from '../src';

type DTMF_CHAR = `${number}` | '*';

describe('Faste phone', () => {
  it('call me', () => {
    const buttons = faste()
      .withMessages(['press'])
      .withSignals<`DTMF-${DTMF_CHAR}`>()
      .on('press', ({ emit }, digit: DTMF_CHAR) => emit(`DTMF-${digit}`))
      .create()
      .start();

    const collector = faste()
      .withState({
        number: '',
        lastNumber: '',
      })
      .withMessages<`DTMF-${DTMF_CHAR}`>()
      .withSignals(['call', 'digit'])
      .scope((faste) =>
        Array(9)
          .fill(1)
          .forEach((_, number) =>
            faste.on(`DTMF-${number}`, ({ state, setState }) =>
              setState({
                number: state.number + number,
                lastNumber: String(number),
              })
            )
          )
      )
      .on('DTMF-*', ({ setState }) => setState({ number: '' }))
      .on('@change', ({ state, emit }) => {
        if (state.number.length >= 7) {
          emit('call', state.number);
        }

        emit('digit', state.lastNumber);
      })
      .create()
      .start();

    const phone = faste()
      .withMessages(['pickup', 'call', 'digit', 'hang'])
      .withSignals(['DTMF'])
      .withPhases(['idle', 'calling', 'incall', 'end'])
      .on('@init', ({ transitTo }) => transitTo('idle'))
      .on('pickup', ['idle'], ({ transitTo }) => transitTo('calling'))
      .on('call', ['calling'], ({ transitTo, setState }, number) => {
        setState({ calledNumber: number });
        transitTo('incall');
      })
      .on('digit', ['incall'], ({ emit }, digit) => emit('DTMF', digit))
      .on('hang', ({ transitTo }) => transitTo('idle'))
      .create()
      .start();

    buttons.connect(collector);
    collector.connect(phone);

    const spy = jest.fn();
    phone.observe(spy);

    const callANumber = (number: string) => {
      number.split('').forEach((c) => buttons.put('press', c));
    };

    callANumber('555-55-55');
    expect(phone.phase()).toBe('idle');
    expect(spy).not.toHaveBeenCalled();

    phone.put('pickup');
    callANumber('*555-55');
    expect(phone.phase()).toBe('calling');
    callANumber('-551234');
    expect(phone.phase()).toBe('incall');
    expect(spy).toHaveBeenCalledWith('incall');

    expect((<any>phone.instance().state).calledNumber).toBe('5555555');
  });
});
