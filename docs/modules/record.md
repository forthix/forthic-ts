# record Module

[← Back to Index](../index.md)

Record (object/dictionary) manipulation operations for working with key-value data structures.

**16 words**

## Categories

- **Core**: REC, REC@, |REC@, <REC!
- **Path access (jq-style)**: JQ@, JQ!, JQ-DEL
- **Construct**: ENTRIES>REC
- **Disassemble**: REC>ENTRIES
- **Combine**: MERGE
- **Subset**: PICK, OMIT
- **Predicate**: HAS-KEY?
- **Transform**: DELETE
- **Access**: KEYS, VALUES

## Words

### <REC!

**Stack Effect:** `( rec:any value:any field:any -- rec:any )`

Set value in record at field path

---

### |REC@

**Stack Effect:** `( records:any field:any -- values:any )`

Map REC@ over array of records

---

### DELETE

**Stack Effect:** `( container:any key:any -- container:any )`

Delete key from record or index from array

---

### ENTRIES>REC

**Stack Effect:** `( pairs:any[] -- rec:any )`

Build a record from an array of [key, value] pairs. Alias of REC, surfaced for symmetry with REC>ENTRIES.

---

### HAS-KEY?

**Stack Effect:** `( rec:any key:any -- bool:boolean )`

Returns true if rec has the given key (own property). Distinct from REC@ NULL == — handles intentional null values correctly.

---

### JQ-DEL

**Stack Effect:** `( container:any path:any -- container:any )`

Delete value at jq-style path. No-op if path doesn't exist. [] iteration not supported.

---

### JQ!

**Stack Effect:** `( container:any value:any path:any -- container:any )`

Set value at jq-style path. Auto-creates missing intermediates (record for field, array for index). [] iteration not supported.

---

### JQ@

**Stack Effect:** `( container:any path:any -- value:any )`

Get value at jq-style path (e.g., .users[].name). Returns null on miss; [] iterates and flattens. Path arrays accepted for dynamic keys.

---

### KEYS

**Stack Effect:** `( container:any -- keys:any[] )`

Get keys from record or indices from array

---

### MERGE

**Stack Effect:** `( rec1:any rec2:any -- merged:any )`

Shallow merge two records. Keys present in rec2 override rec1.

---

### OMIT

**Stack Effect:** `( rec:any keys:any[] -- rec:any )`

Return a new record without the listed keys.

---

### PICK

**Stack Effect:** `( rec:any keys:any[] -- rec:any )`

Return a new record containing only the listed keys (missing keys are skipped).

---

### REC

**Stack Effect:** `( key_vals:any[] -- rec:any )`

Create record from [[key, val], ...] pairs

---

### REC@

**Stack Effect:** `( rec:any field:any -- value:any )`

Get value from record by field or array of fields

---

### REC>ENTRIES

**Stack Effect:** `( rec:any -- pairs:any[] )`

Convert a record to an array of [key, value] pairs (sorted by key for stability). Inverse of ENTRIES>REC / REC.

---

### VALUES

**Stack Effect:** `( container:any -- values:any[] )`

Get values from record or elements from array

---


[← Back to Index](../index.md)
