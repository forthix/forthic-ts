# string Module

[← Back to Index](../index.md)

String manipulation and processing operations with regex and URL encoding support.

**28 words**

## Categories

- **Conversion**: >STR
- **Transform**: LOWERCASE, UPPERCASE, STRIP, ASCII, TRIM-PREFIX, TRIM-SUFFIX
- **Split/Join**: SPLIT, JOIN, CONCAT, LINES, UNLINES
- **Pattern**: REPLACE, RE-REPLACE, RE-MATCH, RE-MATCH-ALL, RE-MATCH?
- **Predicates**: STARTS-WITH?, ENDS-WITH?, RE-MATCH?
- **Bash-flavored**: GREP, GREP-V, SED, CUT
- **Constants**: /N, /T

## Examples

```forthic
["hello" " " "world"] CONCAT
"hello world" STR-LENGTH
"hello world" " " SPLIT
["hello" "world"] " " JOIN
"Hello" LOWERCASE
```

## Words

### /N

**Stack Effect:** `( -- char:string )`

Newline character

---

### /T

**Stack Effect:** `( -- char:string )`

Tab character

---

### >STR

**Stack Effect:** `( item:any -- string:string )`

Convert item to string. Records render as JSON; arrays comma-join their stringified elements.

---

### ASCII

**Stack Effect:** `( string:string -- result:string )`

Keep only ASCII characters (< 256)

---

### CONCAT

**Stack Effect:** `( strings:string[] -- result:string )`

Concatenate an array of strings into one string. For two strings: write [s1 s2] CONCAT. For arrays of arrays, use FLATTEN.

---

### CUT

**Stack Effect:** `( strings:string[] sep:string field:number -- field_values:any[] )`

Split each string on sep and pick the field-th column (bash cut). Out-of-range yields null.

---

### ENDS-WITH?

**Stack Effect:** `( str:string suffix:string -- bool:boolean )`

Returns true if str ends with suffix.

---

### GREP

**Stack Effect:** `( strings:string[] pattern:string -- matches:string[] )`

Keep only strings matching the regex pattern (bash grep).

---

### GREP-V

**Stack Effect:** `( strings:string[] pattern:string -- non_matches:string[] )`

Keep only strings NOT matching the regex pattern (bash grep -v).

---

### JOIN

**Stack Effect:** `( strings:string[] sep:string -- result:string )`

Join strings with separator

---

### LINES

**Stack Effect:** `( str:string -- lines:string[] )`

Split string on newline. Equivalent to /N SPLIT.

---

### LOWERCASE

**Stack Effect:** `( string:string -- result:string )`

Convert string to lowercase

---

### RE-MATCH

**Stack Effect:** `( string:string pattern:string -- match:any )`

Match string against regex pattern

---

### RE-MATCH-ALL

**Stack Effect:** `( string:string pattern:string -- matches:any[] )`

Find all regex matches in string

---

### RE-MATCH?

**Stack Effect:** `( str:string pattern:string -- bool:boolean )`

Returns true if str matches the regex pattern. Predicate-only — does not return the match. (jq's `test`.)

---

### RE-REPLACE

**Stack Effect:** `( string:string pattern:string replace:string -- result:string )`

Replace all regex matches of pattern with replace. Same as classic REPLACE behavior.

---

### REPLACE

**Stack Effect:** `( string:string text:string replace:string -- result:string )`

Replace all literal occurrences of text with replace. For regex matching use RE-REPLACE.

---

### SED

**Stack Effect:** `( strings:string[] pattern:string repl:string -- strings:string[] )`

Apply RE-REPLACE to each string in the array (bash sed s/pattern/repl/g).

---

### SPLICE

**Stack Effect:** `( str:string start:number end:number newval:string -- result:string )`

Replace the substring [start, end) of str with newval and return the result (a splice).

---

### SPLIT

**Stack Effect:** `( string:string sep:string -- items:any[] )`

Split string by separator

---

### STARTS-WITH?

**Stack Effect:** `( str:string prefix:string -- bool:boolean )`

Returns true if str begins with prefix.

---

### STR-LENGTH

**Stack Effect:** `( str:string -- length:number )`

Length of a string in characters (0 if null/undefined).

---

### STRIP

**Stack Effect:** `( string:string -- result:string )`

Trim whitespace from string

---

### SUBSTR

**Stack Effect:** `( str:string start:number end:number -- substring:string )`

Substring of str from start (inclusive) to end (exclusive), by character index. Indices clamp like String.slice (negatives count from the end).

---

### TRIM-PREFIX

**Stack Effect:** `( str:string prefix:string -- result:string )`

Strip prefix from start of str if present (otherwise return str unchanged).

---

### TRIM-SUFFIX

**Stack Effect:** `( str:string suffix:string -- result:string )`

Strip suffix from end of str if present (otherwise return str unchanged).

---

### UNLINES

**Stack Effect:** `( lines:string[] -- str:string )`

Join an array of lines with newlines. Equivalent to /N JOIN.

---

### UPPERCASE

**Stack Effect:** `( string:string -- result:string )`

Convert string to uppercase

---


[← Back to Index](../index.md)
