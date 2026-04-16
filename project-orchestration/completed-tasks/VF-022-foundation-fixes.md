# Task: Foundation Fixes — Core Building Block Bugs

## Task Metadata

```yaml
task_id: 2026-04-02-022
title:
  Fix critical bugs in core building blocks (LibUtils, Result, BaseValueObject,
  EntityId)
type: bug
priority: critical
complexity: complex
estimated_time: 8h
created_by: human
created_at: 2026-04-02 12:00
status: completed
```

## Overview

Audit runda 2 ujawnila ze mikro-fundament biblioteki (na ktorym stoja wszystkie
pakiety) ma realne bugi. Kazdy z tych fiksow dotyczy kodu uzywanego przez 14+
pakietow.

| #    | Problem                                                                           | Plik                              | Severity |
| ---- | --------------------------------------------------------------------------------- | --------------------------------- | -------- |
| BUG1 | \_isSpecialCaseFalse dead code — Object.create(null) === input nigdy nie zadziala | lib-utils.ts:16                   | CRITICAL |
| BUG2 | deepEqual nie obsluguje Date/Map/Set/RegExp — daje false positives                | lib-utils.ts:211-249              | HIGH     |
| BUG3 | EntityId.create() w contracts uzywa Math.random() zamiast UUID                    | entity-id.implementation.ts:85-90 | HIGH     |
| BUG4 | Redundantne API: hasValue/isNotEmpty/isTruthy identyczne — deprecate              | lib-utils.ts:92-170               | MEDIUM   |
| R1   | Result.ok() akceptuje undefined — type hole                                       | result.ts:52                      | HIGH     |
| R3   | Brak mapError() — nie mozna transformowac error type                              | result.ts                         | MEDIUM   |
| VO1  | getValue() zwraca mutowalna referencje — lamie DDD immutability                   | base-value-object.ts:48           | CRITICAL |
| VO4  | Brak Object.freeze() — VO moze byc zmutowany                                      | base-value-object.ts:8-10         | HIGH     |
| VO5  | toJSON() zwraca string nie obiekt — podwojna serializacja                         | base-value-object.ts:37-39        | MEDIUM   |

---

_Task managed by Project Orchestrator | Created: 2026-04-02_
