# Changelog

Written from the git tags and commits: no version had release notes.

## Unreleased

### Fixed

- Declarations compile on current TypeScript with `skipLibCheck` off.
- A destroyed machine stays destroyed: a late async `transitTo` no longer restarts it, and async signals no longer reach
  observers after `destroy()`.
- `start()` with the machine's current phase starts it instead of leaving it stopped.
- An exception in a handler no longer leaves the message queue stuck.
- The queue stops draining when a queued message enters `@busy` or `@locked`.
- Builder variants own their handlers, hooks and guards, and keep `withAsyncSignals()`.
- A thenable returned by a handler no longer needs a `.catch` method.
- `@enter` and `@leave` argument labels name the phases in the order they arrive.
- `setFasteDebug` is exported from the package entry, as the README said.

### Changed

- `exports` map added. `dist/es5` and `dist/es2015` stay reachable.
- `tslib` is no longer a dependency.
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
