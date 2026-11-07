# Examples

Longer examples, moved out of the [README](../README.md).

Try online : https://codesandbox.io/s/n7kv9081xp

## Using different handlers in different states

```js
// common code - invert the flag
onClick = () => this.setState((state) => ({ enabled: !state.enabled }));

// faste - use different flags for different states
faste()
  .on('click', ['disabled'], ({ transitTo }) => transitTo('enabled'))
  .on('click', ['enabled'], ({ transitTo }) => transitTo('disabled'));
```

## React to state change

```js
// common code - try to reverse engineer the change
componentDidUpdate(oldProps);
{
  if (oldProps.enabled !== this.props.enabled) {
    if (this.props.enabled) {
      // I was enabled!
    } else {
      // I was disabled!
    }
  }
}

// faste - use "magic" methods
faste()
  .on('@enter', ['disabled'], () => {
    /* i was disabled */
  })
  .on('@enter', ['enabled'], () => {
    /* i was enabled */
  })
  // or
  .on('@leave', ['disabled'], () => {
    /* i am no more disabled */
  })
  .on('@leave', ['enabled'], () => {
    /* i am no more enabled */
  });
```

## Connected states

https://codesandbox.io/s/5zx8zl91ll

```js
// runs a timer while active, and stops it on leaving or on destroy
const SignalSource = faste()
  .on('tick', ['active'], ({ emit }) => emit('message'))
  .hooks({
    tick: ({ attrs, trigger }) => {
      const interval = setInterval(() => trigger('tick'), attrs.duration);
      return () => clearInterval(interval);
    },
  });

// responds to "message" by moving from tick to tock
// emiting the current state outside
const TickState = faste()
  // autoinit to "tick" mode
  .on('@init', ({ transitTo }) => transitTo('tick'))
  // message handlers
  .on('message', ['tick'], ({ transitTo }) => transitTo('tock'))
  .on('message', ['tock'], ({ transitTo }) => transitTo('tick'))
  .on('@leave', ({ emit }, newPhase) => emit('currentState', newPhase));

// just transfer message to attached node
const DisplayState = faste().on('currentState', ({ attrs }, message) => (attrs.node.innerHTML = message));

// create machines
const signalSource = SignalSource.create().attrs({
  duration: 1000,
});
const tickState = TickState.create();
const displayState = DisplayState.create().attrs({
  node: document.querySelector('.display'),
});

// direct connect signal source and ticker
signalSource.connect(tickState);

// "functionaly" connect tickes and display
tickState.connect((message, payload) => displayState.put(message, payload));

// RUN! a machine ignores messages until it starts, so start the receivers first
displayState.start();
tickState.start();
// then start signal in active mode
signalSource.start('active');
```

## Traffic light

```js
const state = faste()
  .withPhases(['red', 'yellow', 'green'])
  .withMessages(['tick', 'next'])

  .on('tick', ['green'], ({ transitTo }) => transitTo('yellow'))
  .on('tick', ['yellow'], ({ transitTo }) => transitTo('red'))
  .on('tick', ['red'], ({ transitTo }) => transitTo('green'))

  // on 'next' trigger 'tick' for a better debugging.
  // just rethrow event
  .on('next', ({ trigger }) => trigger('tick'))

  // the timer runs as long as the machine does, and destroy stops it
  .hooks({
    next: ({ attrs, trigger }) => {
      const interval = setInterval(() => trigger('next'), attrs.duration);
      return () => clearInterval(interval);
    },
  });

state.create().attrs({ duration: 1000 }).start('green');
```

Try online : https://codesandbox.io/s/n7kv9081xp

## Draggable

```js
const domHook =
  (eventName) =>
  ({ attrs, trigger }) => {
    const callback = (event) => trigger(eventName, event);
    attrs.node.addEventListener(eventName, callback);
    // "hook" could return anything, callback for example
    return () => {
      attrs.node.removeEventListener(eventName, callback);
    };
  };

const state = faste()
  .on('@enter', ['active'], ({ emit }) => emit('start'))
  .on('@leave', ['active'], ({ emit }) => emit('end'))

  .on('mousedown', ['idle'], ({ transitTo }) => transitTo('active'))
  .on('mousemove', ['active'], ({ emit }, event) => emit('move', event))
  .on('mouseup', ['active'], ({ transitTo }) => transitTo('idle'))

  .hooks({
    mousedown: domHook('mousedown'),
    mousemove: domHook('mousemove'),
    mouseup: domHook('mouseup'),
  })

  .create()
  .attrs({ node: document.body })
  .start('idle');
```

## Async

Message handler doesn't have to be sync. But managing async commands could be hard. But will not

1. Accept command only in initial state, then transit to temporal state to prevent other commands to be executes.

```js
const Login = faste().on('login', ['idle'], ({ transitTo }, { userName, password }) => {
  transitTo('logging-in'); // just transit to "other" state
  login(userName, password)
    .then(() => transitTo('logged'))
    .catch(() => transitTo('error'));
});
```

2. Accept command only in initial state, then transit to execution state, and do the job on state enter

```js
const Login = faste()
  .on('login', ['idle'], ({ setState, transitTo }, credentials) => {
    setState({ credentials });
    transitTo('logging');
  })
  .on('@enter', ['logging'], ({ state, transitTo }) => {
    login(state.credentials.userName, state.credentials.password)
      .then(() => transitTo('logged'))
      .catch(() => transitTo('error'));
  });
```

3. Always accept command, but be "busy" while doing stuff

```js
const Login = faste().on('login', ({ transitTo }, { userName, password }) => {
  transitTo('@busy'); // we are "busy"
  return login(userName, password)
    .then(() => transitTo('logged'))
    .catch(() => transitTo('error'));
});
```

> handler returns Promise( could be async ) to indicate that ending in @busy state is not a mistake, and will not lead
> to deadlock.

By default `@busy` will queue messages, executing them after leaving busy phase.
If want to ignore them - instead of `@busy`, you might use `@locked` phase, which will ignore them.

PS: You probably will never need those states.

## Timers

Plain variant

```tsx
const SignalSource = faste()
  .on('@enter', ['active'], ({ setState, attrs, emit }) =>
    setState({ interval: setInterval(() => emit('message'), attrs.duration) })
  )
  .on('@leave', ['active'], ({ state }) => clearInterval(state.interval));
```

`destroy` runs no `@leave`, so this interval outlives a machine destroyed while active. The two variants below stop on
their own.

Hook based

```tsx
const SignalSource = faste()
  .on('tick', ['active'], ({ emit }) => emit('message'))
  .hooks({
    tick: ({ attrs, trigger }) => {
      const interval = setInterval(() => trigger('tick'), attrs.duration);
      return () => clearInterval(interval);
    },
  });
```

Timer based

```tsx
const SignalSource = faste()
  .withTimers({
    T0: 1000,
  })
  .on('on_T0', ['active'], ({ emit, startTimer }) => {
    emit('message');
    startTimer('T0'); //restarts timers
  })
  .on('@enter', ['active'], ({ startTimer }) => startTimer('T0'))
  .on('@leave', ['active'], ({ stopTimer }) => stopTimer('T0'));
```
