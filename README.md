<div align="center">
  <h1>🤖 Faste 💡</h1>
  finite state block machine
  <br/>
  <img src="./assets/blocks.png" alt="memoize" height="233" align="center">
  <br/>
  <br/>
  <a href="https://circleci.com/gh/theKashey/faste/tree/master">
     <img src="https://img.shields.io/circleci/project/github/theKashey/faste/master.svg?style=flat-square)" alt="Build status">
  </a>
  
  <a href="https://codecov.io/github/thekashey/faste">
   <img src="https://img.shields.io/codecov/c/github/thekashey/faste.svg?style=flat-square" />
  </a>
  
  <a href="https://www.npmjs.com/package/faste">
   <img src="https://img.shields.io/npm/v/faste.svg?style=flat-square" />
  </a>
  
  <a href="https://greenkeeper.io/">
   <img alt="Greenkeeper badge" src="https://badges.greenkeeper.io/theKashey/faste.svg"/>
  </a>
  
  <br/>
  <br/>
  <br/>  
</div>  

> no dependencies, and just 1.5kb

This is a Finite State Machine from SDL([Specification and Description Language](https://en.wikipedia.org/wiki/Specification_and_Description_Language)) prospective.
SDL defines state as a set of messages, it should react on, and the actions beneath.

Once `state` receives a `message` it executes an `action`, which could perform calculations and/or change the
current state.

> The goal is not to __change the state__, but - __execute bound action__.
From this prospective faste is closer to RxJX.

Usually "FSM" are more focused on state transitions, often even omitting any operations on message receive.
>In the Traffic Light example it could be usefull, but in more real life examples - no.

Faste is more about _when_ you will be able to do _what_. _What_ you will do, _when_ you receive event, and what you will do next.


Keeping in mind the best practices, like KISS and DRY, it is better to invert state->message->action connection,
as long actions is most complex part of it, and messages are usually reused across different states.

And, make things more common we will call "state" as a "phase", and "state" will be for "internal state".

The key idea is not about transition between states, but transition between behaviors.
Keep in mind - if some handler is not defined in some state, and you are sending a message - it will be __lost__.

> Written in TypeScript. To make things less flexible. Flow definitions as incomplete. 

# Prior art

This library combines ideas from [xstate](https://github.com/davidkpiano/xstate) and [redux-saga](https://github.com/redux-saga/redux-saga).
The original idea is based on [xflow](https://gist.github.com/theKashey/93f10d036961f4bd7dd728153bc4bea9) state machine,
developed for [CT Company](http://www.ctcom.com.tw)'s VoIP solutions back in 2005.

# State machine
 State machine _starts_ in one phase, calls _hooks_ for all _messages_ for the current phase,
 then _awaits_ for a _messages_ from hooks or external customer, then
 could _trigger_ a new message, _emit_ signal to the outer world or _change_ the current phase.
 
 Faste is a black box - you can _put_ message inside, and awaits a _singnal_ it will sent outside, meanwhile
 observing box _phase_. Black📦 == Component🎁.

📖 Read an article about [FASTE, and why to use it](https://medium.com/@antonkorzunov/fasten-your-state-9fb9f9b44f30).

# API
 `faste(options)` - defines a new faste machine
 every faste instance provide next _chainable_ commands 
 - `on(eventName, [phases], callback)` - set a hook `callback` for `eventName` message in states `states`.
 - `hooks(hooks)` - set a hook when some message begins, or ends its presence.
 
 
 - `check()` - the final command to check state
 - `create()` - creates a machine.
 - ~~`callbag()` - returns a callbag.~~ (planned)
 
 In development mode, and for typed languages you could use next commands
 - `withState(state)` - set a initial state (use @init hook to derive state from props).
 - `withPhases(phases)` - limit phases to provided set.
 - `withMessages(messages)` - limit messages to provided set.
 - `withAttrs(attributes)` - limit attributes to provided set.
 - `withSignals(singnals)` - limit signals to provided set.
 
 All methods returns a `faste` constructor;
 
Each instance of Faste will have:
 - `attrs(attrs)` - set attributes.  
 - `put` - put message it
 - `connect` - connects output to the destination
 - `observe` - observes phase changes


 - `phase` - returns the current phase
 - `instance` - returns the current internal state.
 
 
 - `destroy` - exits the current state, terminates all hooks, and stops machine.
 
 - `namedBy(string)` - sets name of the instance (for debug).
 
For all callbacks the first argument is `flow` instance, containing.
 - `attrs` - all the attrs, you cannot change them
 
 
 - `state` - internal state 
 - `setState` - internal state change command
  
  
 - `phase` - current phase
 - `transit` - phase change command.
 
 
 - `emit` - emits a message to the outer world
 
### Magic events 
 - `@init` - on initialization
 - `@enter` - on phase enter, last phase will be passed as a second arg.
 - `@leave` - on phase enter, new phase will be passed as a second arg.
 - `@change` - on state change, old state will be passed as a second arg.
 - `@miss` - on event without handler.
 
### Magic phases
 - `@current` - set the same phase as it was on the handler entry
 - `@busy` - set the _busy_ phase, when no other handler could be called   
 
### Hooks 

Hooks are not required, but then applied should come in a pair - on/off hook. Both hooks will receive `flow` as a first arg,
and `off` will receive result of `on` as a second arg.

Hook took a place when message starts or ends it existance, ie entering or leaving phases if was defined in. 
 
### Event bus
- message handler could change phase, state and trigger a new message
- hook could change state or trigger a new message, but not change phase
- external consumer could only trigger a new message 
 
## InternalState
Each `on` or `hook` handler will receive `internalState` as a first argument, with following shape
```js
{
 attrs: { ...AttributesYouSet };  // attributes
 state: { ..CurrentState };       // state

 setState(newState);              // setState (as seen in React)

 transitTo(phase);                // move to a new phase

 emit(message, ...args);          // emit Signal to the outer world (connected) 

 trigger(event, ...args);         // trigger own message handler (dispatch an internal action) 
``` 

# Debug
Debug mode is integrated into Faste.

```js
import {setFasteDebug} from 'faste'
setFasteDebug(true);
setFasteDebug(true);
setFasteDebug((instance, message, args) => console.log(...));
``` 
 
# Examples 

Try online : https://codesandbox.io/s/n7kv9081xp
 
### Connected states
```js
const SignalSource = faste()
 .on('@enter',['active'], ({setState, attrs, emit}) => setState({ interval: setInterval(() => emit('message'), attrs.duration)}))
 .on('@leave',['active'], ({state}) => clearInterval(state.interval));

const TickState = faste()
 .on('message', ['tick'], ({transit}) => transit('tock')
 .on('message', ['tock'], ({transit}) => transit('tick')
 .on('@leave', ({emit}, newPhase) => emit('currentState', newPhase)); 


const DisplayState = faste()
 .on('display', ({attr}, message) => attrs.node.innerHTML = message);


const signalSource = new SignalSource();
const tickState = new TickState();
const displayState = new DisplayState();

// direct connect
signalSource.connect(tickState);

// functional connect
tickState.connect(message => displayState.put('display', message));

// RUN!
signalSource.start('active');
``` 
 
### Traffic light
 
```js
const state = faste() 
 .withPhases(['red', 'yellow', 'green'])
 .withMessages(['tick'])
 
 .on('next',['green'], ({transit}) => transit('yellow'))
 .on('next',['yellow'], ({transit}) => transit('red'))
 .on('next',['red'], ({transit}) => transit('green'))

  // and let it "tick" by it's own.
 .on('@enter',['green'], ({setState, attrs, trigger}) => setState({ interval: setInterval(() => trigger('next'), attrs.duration)}))
 .on('@leave',['red'], ({state}) => clearInterval(state.interval))
 
 
 .check();

new state()  
  .attrs({duration: 1000})
  .start('green');
```

### Draggable

```js
const domHook = eventName => ({
  'on': ({attrs, trigger}) => {
    const callback = event => trigger(eventName, event);    
    attrs.node.addEventListener(eventName, callback);
    return callback;
  },
  'off': ({attrs}, hook) => {          
      attrs.node.removeEventListener(eventName, hook);
    }
});

const state = faste({}) 
 .on('@enter', ['active'], ({emit}) => emit('start'))
 .on('@leave', ['active'], ({emit}) => emit('end'))
 
 .on('mousedown',['idle'], ({transit}) => transit('active'))
 .on('mousemove',['active'], (_, event) => emit('move',event))
 .on('mouseup', ['active'], ({transit}) => transit('idle'))
 
 hooks({
   'mousedown': domHook('mousedown'),
   'mousemove': domHook('mousemove'),
   'mouseup': domHook('mouseup'),
 })
 .check()

 .attr({node: document.body})
 .create() // just create the class here
 .start('idle');
```

# Async
Message handler doesn't have to be sync. But managing async commands could be hard. But will not

1. Accept command only in initial state, then transit to temporal state to prevent other commands to be executes.
```js
const Login = faste()
 .on('login', ['idle'], ({transit}, {userName, password}) => {
   transit('logging-in'); // just transit to "other" state  
   login(userName, password)
       .then( () => transit('logged'))
       .catch( () => transit('error'))
 });  
```  

2. Accept command only in initial state, then transit to execution state, and do the job on state enter
```js
const Login = faste()
 .on('login', ['idle'], ({transit}, data) => transit('logging', data)
 .on('@enter', ['logging'], ({transit}, {userName, password}) => {                                 
  login(userName, password)
      .then( () => transit('logged'))
      .catch( () => transit('error'))
});  
```  

2. Always accept command, but be "busy" while doing stuff
```js
const Login = faste()
 .on('login', ({transit}, {userName, password}) => {
   transit('@busy'); // we are "busy" 
   return login(userName, password)
       .then( () => transit('logged'))
       .catch( () => transit('error'))
 });  
```  
> handler returns Promise( could be async ) to indicate that ending in @busy state is not a mistake, and will not lead to deadlock.

By default `@busy` will queue messages, executing them after leaving busy phase.
If want to ignore them -  instead of `@busy`, you might use `@locked` phase, which will ignore them.

PS: You probably will never need those states.

# SDL and Block
Faste was born from this. From Q.931(EDSS) state definition.

How it starts. What signals it accepts. What it does next.

![U17](./assets/capeu17.gif)

That is quite simple diagram.

# Licence
 MIT
  
