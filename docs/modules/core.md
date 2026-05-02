# core Module

[← Back to Index](../index.md)

Essential interpreter operations for stack manipulation, variables, control flow, and module system.

**27 words**

## Categories

- **Stack**: POP, DUP, SWAP
- **Variables**: VARIABLES, !, @, !@
- **Module**: USE-MODULES
- **Execution**: RUN
- **Control**: NOP, DEFAULT, DEFAULT-RUN, NULL, IF, IF-RUN, WHEN
- **Predicates**: ARRAY?, NULL?, EMPTY?, STRING?, NUMBER?, RECORD?
- **Options**: ~> (converts array to WordOptions)
- **String**: INTERPOLATE, PRINT
- **Debug**: PEEK!, STACK!

## Options

INTERPOLATE and PRINT support options via the ~> operator using syntax: [.option_name value ...] ~> WORD
- separator: String to use when joining array values (default: ", ")
- null_text: Text to display for null/undefined values (default: "null")
- json: Use JSON.stringify for all values (default: false)

## Examples

```forthic
5 .count ! "Count: .count" PRINT
"Items: .items" [.separator " | "] ~> PRINT
[1 2 3] PRINT                           # Direct printing: 1, 2, 3
[1 2 3] [.separator " | "] ~> PRINT    # With options: 1 | 2 | 3
[ [.name "Alice"] ] REC [.json TRUE] ~> PRINT  # JSON format: {"name":"Alice"}
"Hello .name" INTERPOLATE .greeting !
[1 2 3] DUP SWAP
```

## Words

### !

**Stack Effect:** `( value:any variable:any -- )`

Sets variable value (auto-creates if string name)

---

### !@

**Stack Effect:** `( value:any variable:any -- value:any )`

Sets variable and returns value

---

### @

**Stack Effect:** `( variable:any -- value:any )`

Gets variable value (throws UnknownVariableError if string name is undeclared)

---

### ~>

**Stack Effect:** `( array:any[] -- options:WordOptions )`

Convert options array to WordOptions. Format: [.key1 val1 .key2 val2]

---

### ARRAY?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is an array

---

### DEFAULT

**Stack Effect:** `( value:any default_value:any -- result:any )`

Returns value or default if value is null/undefined/empty string

---

### DEFAULT-RUN

**Stack Effect:** `( value:any forthic:string -- result:any )`

Lazy default: returns value if non-empty, otherwise runs forthic and uses its result. The forthic is only evaluated when needed.

---

### DUP

**Stack Effect:** `( a:any -- a:any a:any )`

Duplicates top stack item

---

### EMPTY?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is null/undefined, an empty string, or a container (array/record) with no entries

---

### IF

**Stack Effect:** `( bool:boolean then_value:any else_value:any -- chosen:any )`

Pure value selection: push then_value if bool is truthy, else push else_value. For lazy code execution use IF-RUN; for one-sided side effects use WHEN.

---

### IF-RUN

**Stack Effect:** `( bool:boolean then_forthic:string else_forthic:string -- ? )`

Conditional code execution: if bool is truthy run then_forthic, otherwise run else_forthic. Branches are Forthic strings.

---

### INTERPOLATE

**Stack Effect:** `( string:string [options:WordOptions] -- result:string )`

Interpolate variables (.name) and return result string. Use \\. to escape literal dots.

---

### NOP

**Stack Effect:** `( -- )`

Does nothing (no operation)

---

### NULL

**Stack Effect:** `( -- null:null )`

Pushes null onto stack

---

### NULL?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is null or undefined

---

### NUMBER?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is a finite number

---

### PEEK!

**Stack Effect:** `( -- )`

Prints top of stack and stops execution

---

### POP

**Stack Effect:** `( a:any -- )`

Removes top item from stack

---

### PRINT

**Stack Effect:** `( value:any [options:WordOptions] -- )`

Print value to stdout. Strings interpolate variables (.name). Non-strings formatted with options. Use \\. to escape literal dots in strings.

---

### RECORD?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is a plain record (object that is not an array and not null)

---

### RUN

**Stack Effect:** `( forthic:string -- ? )`

Run a Forthic string in the current context. Whatever the forthic produces is left on the stack.

---

### STACK!

**Stack Effect:** `( -- )`

Prints entire stack (reversed) and stops execution

---

### STRING?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is a string

---

### SWAP

**Stack Effect:** `( a:any b:any -- b:any a:any )`

Swaps top two stack items

---

### USE-MODULES

**Stack Effect:** `( names:string[] [options:WordOptions] -- )`

Imports modules by name

---

### VARIABLES

**Stack Effect:** `( varnames:string[] -- )`

Creates variables in current module

---

### WHEN

**Stack Effect:** `( bool:boolean forthic:string -- ? )`

If bool is truthy run forthic, otherwise do nothing. The forthic argument is always treated as code (executed in current context).

---


[← Back to Index](../index.md)
