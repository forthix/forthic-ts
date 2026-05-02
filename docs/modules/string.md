# string Module

[← Back to Index](../index.md)

String manipulation and processing operations with regex and URL encoding support.

**25 words**

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
"hello" "world" CONCAT
["a" "b" "c"] CONCAT
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

Convert item to string

---

### ASCII

**Stack Effect:** `( string:string -- result:string )`

Keep only ASCII characters (< 256)

---

### CONCAT

**Stack Effect:** `( str1:string str2:string -- result:string ) OR ( arr1:any[] arr2:any[] -- result:any[] ) OR ( strings:string[] -- result:string )`

Concatenate two strings, two arrays, or an array of strings. Dispatches on top-of-stack type.

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

### SPLIT

**Stack Effect:** `( string:string sep:string -- items:any[] )`

Split string by separator

---

### STARTS-WITH?

**Stack Effect:** `( str:string prefix:string -- bool:boolean )`

Returns true if str begins with prefix.

---

### STRIP

**Stack Effect:** `( string:string -- result:string )`

Trim whitespace from string

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
