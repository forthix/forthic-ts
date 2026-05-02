# array Module

[← Back to Index](../index.md)

Array and collection operations for manipulating arrays and records.

**40 words**

## Categories

- **Access**: NTH, FIRST, LAST, SLICE, TAKE, TAKE-LAST, DROP, LENGTH, INDEX, KEY-OF
- **Transform**: MAP, MAP-AT, REVERSE
- **Combine**: APPEND, ZIP, ZIP-WITH
- **Filter**: FILTER, UNIQUE, UNIQUE-BY, DIFFERENCE, INTERSECTION, UNION
- **Sort**: SORT, SORT-BY, SORT-U
- **Search**: FIND, COUNT
- **Extrema**: MIN-BY, MAX-BY
- **Indexing**: NUMBERED
- **Quantifiers**: ALL?, ANY?
- **Group**: BY-FIELD, GROUP-BY, GROUP-BY-FIELD, GROUPS-OF
- **Iteration**: FOREACH, REDUCE, UNPACK, FLATTEN, TIMES-RUN

## Options

Several words support options via the ~> operator using syntax: [.option_name value ...] ~> WORD
- with_key: Push index/key before value (MAP, FOREACH, GROUP-BY, SELECT)
- push_error: Push error array after execution (MAP, FOREACH)
- depth: Recursion depth for nested operations (MAP, FLATTEN)
- push_rest: Push remaining items after operation (MAP, TAKE)
- comparator: Custom comparison function as Forthic string (SORT)

## Examples

```forthic
[10 20 30] '2 *' MAP
[10 20 30] '+ 2 *' [.with_key TRUE] ~> MAP
[[[1 2]] [[3 4]]] [.depth 1] ~> FLATTEN
[3 1 4 1 5] [.comparator "SWAP -"] ~> SORT
[.with_key TRUE .push_error TRUE] ~> MAP
```

## Words

### ALL?

**Stack Effect:** `( items:any forthic:string -- bool:boolean )`

Returns true if forthic returns truthy for every item. True for empty.

---

### ANY?

**Stack Effect:** `( items:any forthic:string -- bool:boolean )`

Returns true if forthic returns truthy for any item. False for empty.

---

### APPEND

**Stack Effect:** `( container:any item:any -- container:any )`

Append item to array or add key-value to record

---

### BY-FIELD

**Stack Effect:** `( container:any[] field:string -- indexed:any )`

Index records by field value

---

### COUNT

**Stack Effect:** `( items:any forthic:string -- n:number )`

Count items where forthic returns truthy.

---

### DIFFERENCE

**Stack Effect:** `( lcontainer:any rcontainer:any -- result:any )`

Set difference between two containers

---

### DROP

**Stack Effect:** `( container:any n:number -- result:any )`

Drop first n elements from array or record

---

### FILTER

**Stack Effect:** `( container:any forthic:string [options:WordOptions] -- filtered:any )`

Filter items with predicate. Options: with_key (bool)

---

### FIND

**Stack Effect:** `( items:any forthic:string -- item:any )`

Return the first item where forthic returns truthy, or null if none.

---

### FIRST

**Stack Effect:** `( container:any -- item:any )`

Get first element from array or record (sorted-key order for records)

---

### FLATTEN

**Stack Effect:** `( container:any [options:WordOptions] -- flat:any )`

Flatten nested arrays or records. Options: depth (number). Example: [[[1 2]]] [.depth 1] ~> FLATTEN

---

### FOREACH

**Stack Effect:** `( items:any forthic:string [options:WordOptions] -- ? )`

Execute forthic for each item. Options: with_key (bool), push_error (bool). Example: ['a' 'b'] 'PROCESS' [.with_key TRUE] ~> FOREACH

---

### GROUP-BY

**Stack Effect:** `( items:any forthic:string [options:WordOptions] -- grouped:any )`

Group items by function result. Options: with_key (bool). Example: [5 15 25] '10 /' [.with_key TRUE] ~> GROUP-BY

---

### GROUP-BY-FIELD

**Stack Effect:** `( container:any[] field:string -- grouped:any )`

Group records by field value

---

### GROUPS-OF

**Stack Effect:** `( container:any[] n:number -- groups:any[] )`

Split array into groups of size n

---

### INDEX

**Stack Effect:** `( items:any[] forthic:string -- indexed:any )`

Create index mapping from array indices to values

---

### INTERSECTION

**Stack Effect:** `( lcontainer:any rcontainer:any -- result:any )`

Set intersection between two containers

---

### KEY-OF

**Stack Effect:** `( container:any value:any -- key:any )`

Find key of value in container

---

### LAST

**Stack Effect:** `( container:any -- item:any )`

Get last element from array or record

---

### LENGTH

**Stack Effect:** `( container:any -- length:number )`

Get length of array or record

---

### MAP

**Stack Effect:** `( items:any forthic:string [options:WordOptions] -- mapped:any )`

Map function over items. Options: with_key (bool), push_error (bool), depth (num), push_rest (bool). Example: [1 2 3] '2 *' [.with_key TRUE] ~> MAP

---

### MAP-AT

**Stack Effect:** `( container:any key:any|any[] forthic:string -- container:any )`

Apply forthic to the value at key/index, returning a new container with that slot transformed. The key arg may be a single key (one-level update) or a path-array for deep updates. Polymorphic over arrays and records. Equivalent of jq's |= operator.

---

### MAX-BY

**Stack Effect:** `( items:any[] forthic:string -- item:any )`

Return the item with the largest value produced by forthic. Null on empty input.

---

### MIN-BY

**Stack Effect:** `( items:any[] forthic:string -- item:any )`

Return the item with the smallest value produced by forthic. Null on empty input.

---

### NTH

**Stack Effect:** `( container:any n:number -- item:any )`

Get nth element from array or record

---

### NUMBERED

**Stack Effect:** `( items:any[] -- pairs:any[] )`

Pair each item with its index: [v0 v1 v2] -> [[0 v0] [1 v1] [2 v2]]. (Python's enumerate.)

---

### REDUCE

**Stack Effect:** `( container:any initial:any forthic:string -- result:any )`

Reduce array or record with accumulator

---

### REVERSE

**Stack Effect:** `( container:any -- container:any )`

Reverse array

---

### SLICE

**Stack Effect:** `( container:any start:number end:number -- result:any )`

Extract slice from array or record

---

### SORT-BY

**Stack Effect:** `( items:any[] forthic:string -- sorted:any[] )`

Sort items by the value forthic produces (ascending).

---

### SORT-U

**Stack Effect:** `( strings:any[] -- strings:any[] )`

Sort an array and remove duplicates (bash sort -u).

---

### TAKE

**Stack Effect:** `( container:any[] n:number [options:WordOptions] -- result:any[] )`

Take first n elements

---

### TAKE-LAST

**Stack Effect:** `( container:any n:number -- result:any )`

Take last n elements from array or record (sorted-key order for records).

---

### TIMES-RUN

**Stack Effect:** `( num_times:number forthic:string -- )`

Run forthic num_times. Each invocation runs in the current stack — no automatic per-iteration value passing.

---

### UNION

**Stack Effect:** `( lcontainer:any rcontainer:any -- result:any )`

Set union between two containers

---

### UNIQUE

**Stack Effect:** `( array:any[] -- array:any[] )`

Remove duplicates from array

---

### UNIQUE-BY

**Stack Effect:** `( items:any[] forthic:string -- items:any[] )`

Dedupe items by the key forthic produces (keeps first occurrence).

---

### UNPACK

**Stack Effect:** `( container:any -- elements:any )`

Unpack array or record elements onto stack

---

### ZIP

**Stack Effect:** `( container1:any[] container2:any[] -- result:any[] )`

Zip two arrays into array of pairs

---

### ZIP-WITH

**Stack Effect:** `( container1:any[] container2:any[] forthic:string -- result:any[] )`

Zip two arrays with combining function

---


[← Back to Index](../index.md)
