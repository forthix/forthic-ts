# boolean Module

[← Back to Index](../index.md)

Comparison, logic, and membership operations for boolean values and conditions.

**13 words**

## Categories

- **Comparison**: ==, !=, <, <=, >, >=
- **Logic**: OR, AND, NOT
- **Membership**: CONTAINS?
- **Conversion**: >BOOL

## Examples

```forthic
5 3 >
"hello" "hello" ==
[1 2 3] [4 5 6] OR
2 [1 2 3] IN
```

## Words

### !=

**Stack Effect:** `( a:any b:any -- not_equal:boolean )`

Test inequality

---

### <

**Stack Effect:** `( a:any b:any -- less_than:boolean )`

Less than

---

### <=

**Stack Effect:** `( a:any b:any -- less_equal:boolean )`

Less than or equal

---

### ==

**Stack Effect:** `( a:any b:any -- equal:boolean )`

Test equality

---

### >

**Stack Effect:** `( a:any b:any -- greater_than:boolean )`

Greater than

---

### >=

**Stack Effect:** `( a:any b:any -- greater_equal:boolean )`

Greater than or equal

---

### >BOOL

**Stack Effect:** `( a:any -- bool:boolean )`

Convert to boolean (JavaScript truthiness)

---

### ALL

**Stack Effect:** `( items1:any[] items2:any[] -- all:boolean )`

Check if all items from items2 are in items1

---

### AND

**Stack Effect:** `( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )`

Logical AND of two values or array

---

### ANY

**Stack Effect:** `( items1:any[] items2:any[] -- any:boolean )`

Check if any item from items1 is in items2

---

### CONTAINS?

**Stack Effect:** `( haystack:any[] needle:any -- bool:boolean )`

Check if haystack array contains needle. Container-first arg order.

---

### NOT

**Stack Effect:** `( bool:boolean -- result:boolean )`

Logical NOT

---

### OR

**Stack Effect:** `( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )`

Logical OR of two values or array

---


[← Back to Index](../index.md)
