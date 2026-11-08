# Changelog

Written from the git tags and commits: no version had release notes.

## Unreleased

### Fixed

- Declarations compile on current TypeScript with `skipLibCheck` off.
- A destroyed machine stays destroyed: a late async `transitTo` no longer restarts it, and async signals no longer reach
  observers after `destroy()`.
- `start()` with the machine's current phase starts it instead of leaving it stopped.
- `start()` after `destroy()` is a new run: instances, hook callbacks, timers and async signals of the earlier run do
  nothing to it, and a late rejection from that run is logged instead of reaching its `@error` handlers.
- `start()` after `destroy()` is a full entry for any phase: `@enter`, observers and every hook, shared ones included.
- `start()` on a running machine destroys it first, so the new run starts clean: its hooks go off, its timers stop and
  its handles do nothing. It used to keep them, and turn the phase-free hooks on a second time.
- A transition stops where its run ends: when `@leave`, `@init`, a hook or an observer destroys or restarts the
  machine, the transition turns on no further hook and does not finish in the new run.
- An exception in a handler no longer leaves the message queue stuck.
- A destroyed machine drops its queue, and no later handler of the same message runs.
- A delivery throws its first failure. A queued failure no longer replaces it: the queue still drains, and each later
  failure goes to `console.error`.
- The queue stops draining when a queued message enters `@busy` or `@locked`.
- Builder variants own their handlers, hooks and guards, and keep `withAsyncSignals()`.
- A thenable returned by a handler no longer needs a `.catch` method.
- `@enter` and `@leave` argument labels name the phases in the order they arrive.
- `setFasteDebug` is exported from the package entry, as the README said.

### Changed

- `exports` map added. `dist/es5` and `dist/es2015` stay reachable.
- `tslib` is no longer a dependency.
- `engines` asks for Node 22 or newer, the oldest version the packed package is checked on. It used to say 10, which
  nothing tested.
- `destroy()` ends the run before it cleans up, so a hook's cleanup or an observer cannot act on the machine, and a
  second `destroy()` does nothing.
- `observe()` subscriptions survive `destroy()`, as `connect()` ones do, so they see the next run.
- `module:es2019` removed: it pointed at a directory no build produced.

## 2.0.0 - 2023-03-18

Promotes the alphas below.

## 2.0.0-alpha.5 - 2023-01-24

- Cut events after machine destruction.

## 2.0.0-alpha.4 - 2023-01-24

- Stop timers on machine destroy.
- Deny messages to a machine that is not active.

## 2.0.0-alpha.3 - 2023-01-23

- Enforce type safety over the external API.

## 2.0.0-alpha.2 - 2023-01-23

- Call observers before calling own hooks.

## 2.0.0-alpha.1 - 2023-01-22

- Refactor type safety.

## 2.0.0-alpha.0 - 2023-01-21

- Major version 2: error handling through `@error`, including async handlers, and type safety in the scripts.

## 1.1.1 - 2019-05-14

- Make `@init` phase bound, separate create and start.

## 1.1.0 - 2019-05-14

- Add guards and traps.
- Add `withTransitions`, restore JSDoc.

## 1.0.0 - 1.0.5 - 2018-05-21 to 2018-06-09

Early releases. The npm registry holds the dates; the commits are not itemised here.
