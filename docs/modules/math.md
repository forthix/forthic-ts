# math Module

[← Back to Index](../index.md)

Mathematical operations and utilities including arithmetic, aggregation, and conversions.

**22 words**

## Categories

- **Arithmetic**: +, -, *, /, MOD, RANGE
- **Aggregates**: MEAN, MAX, MIN, SUM, PRODUCT, MAX-OF, MIN-OF
- **Type conversion**: >INT, >FLOAT, FORMAT-FIXED, ROUND
- **Math functions**: ABS, SQRT, FLOOR, CEIL, CLAMP

## Examples

```forthic
5 3 +
[1 2 3 4] SUM
[10 20 30] MEAN
3.7 ROUND
0 100 UNIFORM-RANDOM
```

## Words

### -

**Stack Effect:** `( a:number b:number -- difference:number )`

Subtract b from a

---

### *

**Stack Effect:** `( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )`

Multiply two numbers or product of array

---

### /

**Stack Effect:** `( a:number b:number -- quotient:number )`

Divide a by b

---

### +

**Stack Effect:** `( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )`

Add two numbers or sum array

---

### >FLOAT

**Stack Effect:** `( a:any -- float:number )`

Convert to float

---

### >INT

**Stack Effect:** `( a:any -- int:number )`

Convert to integer (returns length for arrays/objects, 0 for null)

---

### ABS

**Stack Effect:** `( n:number -- abs:number )`

Absolute value

---

### CEIL

**Stack Effect:** `( n:number -- ceil:number )`

Round up to integer

---

### CLAMP

**Stack Effect:** `( value:number min:number max:number -- clamped:number )`

Constrain value to range [min, max]

---

### FLOOR

**Stack Effect:** `( n:number -- floor:number )`

Round down to integer

---

### FORMAT-FIXED

**Stack Effect:** `( num:number digits:number -- result:string )`

Format number with fixed decimal places

---

### MAX

**Stack Effect:** `( a:number b:number -- max:number ) OR ( items:number[] -- max:number )`

Maximum of two numbers or array

---

### MAX-OF

**Stack Effect:** `( numbers:number[] -- max:number )`

Maximum of array of numbers. Null/undefined elements are skipped. Returns null for empty/all-null array.

---

### MEAN

**Stack Effect:** `( items:any[] -- mean:any )`

Calculate mean of array (handles numbers, strings, objects)

---

### MIN

**Stack Effect:** `( a:number b:number -- min:number ) OR ( items:number[] -- min:number )`

Minimum of two numbers or array

---

### MIN-OF

**Stack Effect:** `( numbers:number[] -- min:number )`

Minimum of array of numbers. Null/undefined elements are skipped. Returns null for empty/all-null array.

---

### MOD

**Stack Effect:** `( m:number n:number -- remainder:number )`

Modulo operation (m % n)

---

### PRODUCT

**Stack Effect:** `( numbers:number[] -- product:number )`

Product of array of numbers (1 if empty). Null/undefined elements yield null.

---

### RANGE

**Stack Effect:** `( start:number end:number -- numbers:number[] )`

Generate inclusive integer range from start to end (e.g. 1 5 RANGE -> [1,2,3,4,5]). Empty if start > end.

---

### ROUND

**Stack Effect:** `( num:number -- int:number )`

Round to nearest integer

---

### SQRT

**Stack Effect:** `( n:number -- sqrt:number )`

Square root

---

### SUM

**Stack Effect:** `( numbers:number[] -- sum:number )`

Sum of array (explicit)

---


[← Back to Index](../index.md)
