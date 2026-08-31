# Task: Invalidating a compensation that a later step made stale

## Task Metadata

```yaml
task_id: VF-042
title:
  'feat: decide whether CompensationStack needs a way to un-arm a compensation
  superseded by a later step (the "confirm" of reserve/confirm/release), and if
  so, in what shape'
type: feature
priority: medium
complexity: medium
estimated_time: 6h
created_by: VF-040 (consumer exchange, 2026-08-30/31)
created_at: 2026-08-31
status: backlog
updated_at: 2026-08-31
release_target: undecided — see framing question
package: "'@vytches/ddd-resilience'"
findings: [VF-040 D-07, VF-040 D-09, VF-040 consumer round 2]
```

## Framing question — answer this BEFORE designing anything

**Is the answer an API at all, or is it a documented rule?**

This task exists because a consumer proposed a concrete method. That proposal is
not the starting point; it is one candidate answer. The evidence gathered after
it was written points at least as strongly toward "write down that confirmation
must be the last operation" as toward "add a method". An analysis that opens
with _how to implement the method_ will have skipped the only question that can
still save us a permanently frozen public name.

Do not treat the proposed shape below as approved scope.

## Why

VF-040 shipped `CompensationStack`: acquisition and its undo are registered in
one expression, unwinding is sequential LIFO, idempotent via a promise latch,
and it also runs when the flow throws.

What it does **not** model is the middle step of the three-step protocol the
original report named: `reserve → confirm → release`. There is no way to say
"this step has been confirmed elsewhere, its undo is now stale, do not run it".

Combined with the VF-040 decision that the stack stays armed after a successful
flow (so a hook running after transaction rollback has something to unwind),
there is a reachable path where an already-confirmed resource gets released.

### What the consumer exchange actually established

Read this before deciding the shape — it materially narrows the problem.

1. **In their real code the stack holds exactly one entry.** One reservation per
   handler execution, confirmed or released on the same identifier,
   sequentially, in one await chain. No handler of this type holds two
   reservations at once.
2. **Confirmation is never out of order**, and after it the step is irreversible
   — their domain has no refund path once the wallet is debited.
3. **Acquisition and unwinding are never concurrent phases** in their usage.
4. **Their real defect was something else entirely.** Reading their two handlers
   found a live bug: one of them ran a further repository write _after_ the
   confirmation block, unwrapped, so a throw there rolled the transaction back
   while the tokens stayed consumed — charge without delivery, with no log and
   no reconciliation entry. Their own fix is to move that write before the
   confirmation, making confirmation the last operation, which is exactly the
   shape their other handler already had.

**Consequence for this task:** with confirmation last and one entry on the
stack, the proposed method has no use in the only real-world usage available to
us. It earns its keep only at two or more resources, or with out-of-order
confirmation — neither of which anyone has yet shown in production code. That is
what the framing question has to settle.

### The consumer's proposed shape, and why it is not simply adoptable

The proposal was a method removing the most recently acquired entry whose
`acquire`-returned value matches by identity, returning a boolean, without
running its compensation.

Three objections, all of which the analysis must resolve or dismiss on the
record:

- **Silent miss.** The likely failure is a match that stops matching after a
  refactor. Nothing signals it; the compensation stays armed and a later unwind
  releases a confirmed resource. That is the silent-failure class this primitive
  exists to remove, reintroduced through a boolean nobody checks. It also
  re-splits acquisition and its undo into two instructions in two places —
  precisely the pattern that broke two of the ten hand-written handlers in the
  original report.
- **Race with an in-flight unwind.** The unwind loop iterates the entry list by
  index with an `await` inside. Splicing from another call during that loop
  shifts the indices and the loop **skips** an entry, so a compensation silently
  never runs. The proposal defines no behaviour for "unwind is latched" or
  "unwind is in flight". This must be specified before any code exists.
- **Values are not reliable keys.** An acquisition whose side effect has no
  handle returns `undefined`; every such entry is then indistinguishable. Any
  matching scheme has to say what happens there.

### Open design questions

- **Q1** — What is the behaviour when unwinding is already latched or in flight?
  Reject, no-op, or throw? Whatever it is, it must not be able to make a
  registered compensation silently disappear.
- **Q2** — How does a failed invalidation stop being silent? A boolean return is
  the weakest available answer. Candidates: return the removed entry's label,
  return a `Result`, throw on programmer error (defensible in this package,
  which is not the domain layer), or address entries by a handle rather than
  searching for them.
- **Q3** — Should confirmation be modelled at acquisition time instead of looked
  up afterwards? Naming the confirm alongside the acquire and the compensate
  keeps the VF-040 structural guarantee intact — the undo is never separated
  from the thing it undoes. It costs a wider `acquire` signature. This is the
  option most likely to be right and least likely to be proposed, because it is
  the least convenient.
- **Q4** — Does the answer change if a stack is documented as single-entry? If a
  stack is meant for one resource, this whole problem is a documentation
  problem.

## Candidate scope to fold in (decide during analysis)

Two findings from the VF-040 final gate were deliberately left unaddressed
because neither blocked release. Both live in the same file and would be cheap
to close alongside whatever this task produces — or as their own chore if this
task concludes "no API needed":

1. **The compensation-failure list is `readonly` in the type but a single shared
   mutable array at runtime**, handed to every caller of unwind. A consumer
   casting the modifier away mutates what everyone else sees.
2. **No timeout on the unwind triggered from the throw path.** A hanging
   compensation now delays the propagating exception indefinitely, so a crash
   presents as a hang. Consistent with the standing decision not to build
   timeout/retry into the primitive, but the throw path changes what the cost of
   that decision looks like.

## Acceptance Criteria

To be written after the framing question is answered. Deliberately empty — an AC
list drafted now would presuppose the method.

The one criterion that holds regardless of outcome:

- [ ] Whatever ships — method, documented rule, or nothing — the reasoning is
      recorded, including the case for _not_ shipping an API, so the next person
      who receives this proposal does not re-litigate it from zero.

## Not in scope

- Durability, restart recovery, and multi-step orchestration. Permanently out of
  scope for this library by owner decision (VF-040 OQ-1), not merely deferred.
- Any change to the acquire/unwind guarantees frozen by VF-040:
  single-expression registration, sequential LIFO unwinding, per-iteration error
  containment, promise-latched idempotency, unconditional failure shape.
- The consumer's own handler fix. Their repository, their change.

## Priority note

Not urgent, and the consumer said so explicitly: they have no timing pressure on
this, and their need disappears once confirmation is last. Adding it later is
purely additive, so waiting costs nothing. Shipping the wrong shape early costs
a name that can never be corrected without a major version.
