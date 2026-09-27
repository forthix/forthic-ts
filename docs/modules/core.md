# core Module

[← Back to Index](../index.md)

Essential interpreter operations for stack manipulation, variables, control flow, and module system.

**40 words**

## Categories

- **Stack**: DROP, DUP, SWAP
- **Variables**: VARIABLES, !, @, !@
- **Module**: USE-MODULES, MODULE, END-MODULE, APP-MODULE
- **Execution**: RUN
- **Closures**: CLOSURE, CLOSURE?, CLOSURE-CODE
- **Code**: >LITERAL, CODE>, >CODE, GENSYM
- **Control**: NOP, DEFAULT, DEFAULT-RUN, NULL, UNDEFINED, IF, IF-RUN, WHEN
- **Predicates**: ARRAY?, NULL?, EMPTY?, STRING?, NUMBER?, RECORD?
- **Errors**: TRY, OK?, ERROR?, UNWRAP, UNWRAP-OR (Rust Result semantics: 'CODE' TRY UNWRAP is CODE)
- **Options**: ~> (converts a record to WordOptions)
- **String**: INTERPOLATE, PRINT
- **Debug**: PEEK!, STACK!

## Options

INTERPOLATE and PRINT support options via the ~> operator using syntax: { .option_name value ... } ~> WORD
- separator: String to use when joining array values (default: ", ")
- null_text: Text for null/undefined values and missing variables (default: "")
- json: Use JSON.stringify for all values (default: false)

## Examples

```forthic
5 .count ! "Count: \${count}" PRINT
"Items: \${items}" { .separator " | " } ~> PRINT
[1 2 3] PRINT                           # Direct printing: 1, 2, 3
[1 2 3] { .separator " | " } ~> PRINT   # With options: 1 | 2 | 3
{ .name "Alice" } { .json TRUE } ~> PRINT  # JSON format: {"name":"Alice"}
"Hello \${name}" INTERPOLATE .greeting !
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

### >CODE

**Stack Effect:** `( quotation:any[] -- code:string )`

Write a quotation as Forthic code. Takes the items CODE> makes; any other item is a value, written with >LITERAL, so a quotation works as a template. A string item must be one word — write a string value as { .str value }. code CODE> >CODE CODE> equals code CODE>.

---

### >LITERAL

**Stack Effect:** `( value:any -- code:string )`

Write a value as Forthic code that pushes it: value >LITERAL RUN gives the value back. Use it to put a value into generated code — never CONCAT or INTERPOLATE a value into code, because a quote in the value would change the code. Records with keys that are not valid dot symbols are written with REC. Closures, instants, and options have no literal.

---

### ~>

**Stack Effect:** `( record:any -- options:WordOptions )`

Convert a record to WordOptions. Format: { .key1 val1 .key2 val2 }. The flat array form [.key1 val1] is also accepted.

---

### APP-MODULE

**Stack Effect:** `( -- )`

Make the application module the current module

---

### ARRAY?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is an array

---

### CLOSURE

**Stack Effect:** `( forthic:string -- closure:closure )`

Bind Forthic code to the current word's local variables. RUN, MAP, IF-RUN and every other word that takes code accept the result, and it reads and writes the creating word's .vars wherever it runs — inside another word, after the creating word returns, or in a parallel MAP. Use it when code leaves the word: passed to a user-defined word, stored in a variable, or returned.

---

### CLOSURE-CODE

**Stack Effect:** `( closure:closure -- forthic:string )`

The Forthic code of a closure

---

### CLOSURE?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is a closure

---

### DEFAULT

**Stack Effect:** `( value:any default_value:any -- result:any )`

Returns value or default if value is null/undefined/empty string

---

### DEFAULT-RUN

**Stack Effect:** `( value:any forthic:string -- result:any )`

Lazy default: returns value if non-empty, otherwise runs forthic and uses its result. The forthic is only evaluated when needed.

---

### DROP

**Stack Effect:** `( a:any -- )`

Removes top item from stack

---

### DUP

**Stack Effect:** `( a:any -- a:any a:any )`

Duplicates top stack item

---

### EMPTY?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is null/undefined, an empty string, or a container (array/record) with no entries

---

### END-MODULE

**Stack Effect:** `( -- )`

Pop the current module from the module stack

---

### ERROR?

**Stack Effect:** `( outcome:record -- boolean:boolean )`

True if outcome is an error record (structural: has an 'error' key)

---

### GENSYM

**Stack Effect:** `( prefix:string -- name:string )`

A new variable name, prefix~N, that no other name can collide with. Use it for the temporary variables of generated code, so they cannot capture the caller's variables.

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

Fill ${name} holes from variables (${.name} also works; read-only — a miss renders as null_text and creates nothing). Holes are variable names, never expressions. Escape a literal with \\${. Null template stays null.

---

### MODULE

**Stack Effect:** `( module_name:string -- )`

Find or create submodule in current module and make it the current module

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

Returns true if value is a number (Infinity is a number; NaN is not)

---

### OK?

**Stack Effect:** `( outcome:record -- boolean:boolean )`

True if outcome is an ok record (structural: has an 'ok' key)

---

### PEEK!

**Stack Effect:** `( -- )`

Prints top of stack and stops execution

---

### PRINT

**Stack Effect:** `( value:any [options:WordOptions] -- )`

Print value to stdout. Strings interpolate ${name} holes first; other values format with the same options. Escape a literal with \\${.

---

### RECORD?

**Stack Effect:** `( value:any -- boolean:boolean )`

Returns true if value is a plain record (object that is not an array and not null)

---

### RUN

**Stack Effect:** `( forthic:string -- ? )`

Run a Forthic string in the current context, or a closure in the context it was created in. Whatever the forthic produces is left on the stack.

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

### UNWRAP

**Stack Effect:** `( outcome:record -- value:any )`

Extract the ok value from a TRY outcome; re-raises for an error outcome (preserving message and error_type). 'CODE' TRY UNWRAP ≡ CODE.

---

### UNWRAP-OR

**Stack Effect:** `( outcome:record default:any -- value:any )`

Extract the ok value from a TRY outcome, or default if it is an error outcome

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
