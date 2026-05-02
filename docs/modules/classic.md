# classic Module

[← Back to Index](../index.md)

**35 words**

## Words

### *DEFAULT

**Stack Effect:** `( value:any default_forthic:string -- result:any )`

Returns value or executes Forthic if value is null/undefined/empty string

---

### /R

**Stack Effect:** `( -- char:string )`

Carriage return character

---

### <DEL

**Stack Effect:** `( container:any key:any -- container:any )`

Delete key from record or index from array. Surfaced as DELETE in record_module.

---

### <REPEAT

**Stack Effect:** `( item:any forthic:string num_times:number -- )`

Repeat execution of forthic num_times. Surfaced as TIMES-RUN in array_module (simpler ( num forthic -- ) semantics).

---

### >FIXED

**Stack Effect:** `( num:number digits:number -- result:string )`

Format number with fixed decimal places. Surfaced as FORMAT-FIXED in math_module.

---

### ADD

**Stack Effect:** `( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )`

Add two numbers or sum array

---

### DATE>INT

**Stack Effect:** `( date:Temporal.PlainDate -- int:number )`

Convert date to integer (YYYYMMDD)

---

### DIVIDE

**Stack Effect:** `( a:number b:number -- quotient:number )`

Divide a by b

---

### END-LOG

**Stack Effect:** `( -- )`

Ends logging interpreter stream

---

### EXPORT

**Stack Effect:** `( names:string[] -- )`

Exports words from current module

---

### IDENTITY

**Stack Effect:** `( -- )`

Does nothing (identity operation)

---

### IN

**Stack Effect:** `( item:any array:any[] -- in:boolean )`

Check if item is in array. Surfaced as CONTAINS? in boolean_module (with reversed args: haystack-first).

---

### INFINITY

**Stack Effect:** `( -- infinity:number )`

Push Infinity value

---

### INTERPRET

**Stack Effect:** `( string:string -- )`

Interprets Forthic string in current context. Surfaced as RUN in core.

---

### INVERT-KEYS

**Stack Effect:** `( record:any -- inverted:any )`

Invert two-level nested record structure

---

### JSON-PRETTIFY

**Stack Effect:** `( json:string -- pretty:string )`

Format JSON with 2-space indentation

---

### MULTIPLY

**Stack Effect:** `( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )`

Multiply two numbers or product of array

---

### NAND

**Stack Effect:** `( a:boolean b:boolean -- result:boolean )`

Logical NAND (not and)

---

### PROFILE-DATA

**Stack Effect:** `( -- profile_data:object )`

Returns profiling data (word counts and timestamps)

---

### PROFILE-END

**Stack Effect:** `( -- )`

Stops profiling word execution

---

### PROFILE-START

**Stack Effect:** `( -- )`

Starts profiling word execution

---

### PROFILE-TIMESTAMP

**Stack Effect:** `( label:string -- )`

Records profiling timestamp with label

---

### RE-MATCH-GROUP

**Stack Effect:** `( match:any num:number -- result:any )`

Get capture group from regex match

---

### REC-DEFAULTS

**Stack Effect:** `( record:any key_vals:any[] -- record:any )`

Set default values for missing/empty fields. Modern path is `defaults_rec input_rec MERGE`.

---

### RELABEL

**Stack Effect:** `( container:any old_keys:any[] new_keys:any[] -- container:any )`

Rename record keys

---

### ROTATE

**Stack Effect:** `( container:any -- container:any )`

Rotate container by moving last element to front

---

### SELECT

**Stack Effect:** `( container:any forthic:string [options:WordOptions] -- filtered:any )`

Filter items with predicate. Surfaced as FILTER in array_module.

---

### SHUFFLE

**Stack Effect:** `( array:any[] -- array:any[] )`

Shuffle array randomly

---

### START-LOG

**Stack Effect:** `( -- )`

Starts logging interpreter stream

---

### SUBTRACT

**Stack Effect:** `( a:number b:number -- difference:number )`

Subtract b from a

---

### SUBTRACT-DATES

**Stack Effect:** `( date1:Temporal.PlainDate date2:Temporal.PlainDate -- num_days:number )`

Get difference in days between dates (date1 - date2). Surfaced as DAYS-BETWEEN in datetime_module.

---

### UNIFORM-RANDOM

**Stack Effect:** `( low:number high:number -- random:number )`

Generate random number in range [low, high)

---

### URL-DECODE

**Stack Effect:** `( urlencoded:string -- decoded:string )`

URL decode string

---

### URL-ENCODE

**Stack Effect:** `( str:string -- encoded:string )`

URL encode string

---

### XOR

**Stack Effect:** `( a:boolean b:boolean -- result:boolean )`

Logical XOR (exclusive or)

---


[← Back to Index](../index.md)
