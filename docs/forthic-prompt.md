# Forthic Standard Words (LLM Reference)

Reference for generating Forthic code. Each line: NAME ( stack-effect ) — description.
Stack notation: ( inputs -- outputs ). Top of stack is rightmost.
Forthic is postfix: arguments precede the word.

String escapes interpreted in regular strings ('...', "..."):
  \n \t \r \0 \\ \" \'  — anything else stays literal (regex \d, \w, etc. unaffected).
Triple-quoted strings ('''...''', """...""") are fully raw.

---

8 modules · 163 words

## array
- `ALL?` `( items:any forthic:string -- bool:boolean )` — Returns true if forthic returns truthy for every item. True for empty.
- `ANY?` `( items:any forthic:string -- bool:boolean )` — Returns true if forthic returns truthy for any item. False for empty.
- `APPEND` `( container:any item:any -- container:any )` — Append item to array or add key-value to record
- `BY-FIELD` `( container:any[] field:string -- indexed:any )` — Index records by field value
- `COUNT` `( items:any forthic:string -- n:number )` — Count items where forthic returns truthy.
- `DIFFERENCE` `( lcontainer:any rcontainer:any -- result:any )` — Set difference between two containers
- `DROP` `( container:any n:number -- result:any )` — Drop first n elements from array or record
- `FILTER` `( container:any forthic:string [options:WordOptions] -- filtered:any )` — Filter items with predicate. Options: with_key (bool)
- `FILTER-WITH-KEY` `( container:any forthic:string -- filtered:any )` — FILTER with key/index pushed to forthic before value. Alias for FILTER { .with_key TRUE }.
- `FIND` `( items:any forthic:string -- item:any )` — Return the first item where forthic returns truthy, or null if none.
- `FIRST` `( container:any -- item:any )` — Get first element from array or record (sorted-key order for records)
- `FLATTEN` `( container:any [options:WordOptions] -- flat:any )` — Flatten nested arrays or records. Options: depth (number). Example: [[[1 2]]] [.depth 1] ~> FLATTEN
- `FOREACH` `( items:any forthic:string [options:WordOptions] -- ? )` — Execute forthic for each item. Options: with_key (bool), push_error (bool). Example: ['a' 'b'] 'PROCESS' [.with_key TRUE] ~> FOREACH
- `FOREACH-WITH-KEY` `( items:any forthic:string -- ? )` — FOREACH with key/index pushed to forthic before value. Alias for FOREACH { .with_key TRUE }.
- `GROUP-BY` `( items:any forthic:string [options:WordOptions] -- grouped:any )` — Group items by function result. Options: with_key (bool). Example: [5 15 25] '10 /' [.with_key TRUE] ~> GROUP-BY
- `GROUP-BY-FIELD` `( container:any[] field:string -- grouped:any )` — Group records by field value
- `GROUP-BY-WITH-KEY` `( items:any forthic:string -- grouped:any )` — GROUP-BY with key/index pushed to forthic before value. Alias for GROUP-BY { .with_key TRUE }.
- `GROUPS-OF` `( container:any[] n:number -- groups:any[] )` — Split array into groups of size n
- `INDEX` `( items:any[] forthic:string -- indexed:any )` — Create index mapping from array indices to values
- `INTERSECTION` `( lcontainer:any rcontainer:any -- result:any )` — Set intersection between two containers
- `KEY-OF` `( container:any value:any -- key:any )` — Find key of value in container
- `LAST` `( container:any -- item:any )` — Get last element from array or record
- `LENGTH` `( container:any -- length:number )` — Get length of array or record
- `MAP` `( items:any forthic:string [options:WordOptions] -- mapped:any )` — Map function over items. Options: with_key (bool), push_error (bool), depth (num), push_rest (bool). Example: [1 2 3] '2 *' [.with_key TRUE] ~> MAP
- `MAP-AT` `( container:any key:any|any[] forthic:string -- container:any )` — Apply forthic to the value at key/index, returning a new container with that slot transformed. The key arg may be a single key (one-level update) or a path-array for deep updates. Polymorphic over arrays and records. Equivalent of jq's |= operator.
- `MAP-WITH-KEY` `( items:any forthic:string -- mapped:any )` — MAP with key/index pushed to forthic before value. Alias for MAP { .with_key TRUE }.
- `MAX-BY` `( items:any[] forthic:string -- item:any )` — Return the item with the largest value produced by forthic. Null on empty input.
- `MIN-BY` `( items:any[] forthic:string -- item:any )` — Return the item with the smallest value produced by forthic. Null on empty input.
- `NTH` `( container:any n:number -- item:any )` — Get nth element from array or record
- `NUMBERED` `( items:any[] -- pairs:any[] )` — Pair each item with its index: [v0 v1 v2] -> [[0 v0] [1 v1] [2 v2]]. (Python's enumerate.)
- `REDUCE` `( container:any initial:any forthic:string -- result:any )` — Reduce array or record with accumulator
- `REVERSE` `( container:any -- container:any )` — Reverse array
- `SLICE` `( container:any start:number end:number -- result:any )` — Extract slice from array or record
- `SORT-BY` `( items:any[] forthic:string -- sorted:any[] )` — Sort items by the value forthic produces (ascending).
- `SORT-U` `( strings:any[] -- strings:any[] )` — Sort an array and remove duplicates (bash sort -u).
- `TAKE` `( container:any[] n:number [options:WordOptions] -- result:any[] )` — Take first n elements
- `TAKE-LAST` `( container:any n:number -- result:any )` — Take last n elements from array or record (sorted-key order for records).
- `TIMES-RUN` `( num_times:number forthic:string -- )` — Run forthic num_times. Each invocation runs in the current stack — no automatic per-iteration value passing.
- `UNION` `( lcontainer:any rcontainer:any -- result:any )` — Set union between two containers
- `UNIQUE` `( array:any[] -- array:any[] )` — Remove duplicates from array
- `UNIQUE-BY` `( items:any[] forthic:string -- items:any[] )` — Dedupe items by the key forthic produces (keeps first occurrence).
- `UNPACK` `( container:any -- elements:any )` — Unpack array or record elements onto stack
- `ZIP` `( container1:any[] container2:any[] -- result:any[] )` — Zip two arrays into array of pairs
- `ZIP-WITH` `( container1:any[] container2:any[] forthic:string -- result:any[] )` — Zip two arrays with combining function

## boolean
- `!=` `( a:any b:any -- not_equal:boolean )` — Test inequality
- `<` `( a:any b:any -- less_than:boolean )` — Less than
- `<=` `( a:any b:any -- less_equal:boolean )` — Less than or equal
- `==` `( a:any b:any -- equal:boolean )` — Test equality
- `>` `( a:any b:any -- greater_than:boolean )` — Greater than
- `>=` `( a:any b:any -- greater_equal:boolean )` — Greater than or equal
- `>BOOL` `( a:any -- bool:boolean )` — Convert to boolean (JavaScript truthiness)
- `ALL` `( items1:any[] items2:any[] -- all:boolean )` — Check if all items from items2 are in items1
- `AND` `( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )` — Logical AND of two values or array
- `ANY` `( items1:any[] items2:any[] -- any:boolean )` — Check if any item from items1 is in items2
- `CONTAINS?` `( haystack:any[] needle:any -- bool:boolean )` — Check if haystack array contains needle. Container-first arg order.
- `NOT` `( bool:boolean -- result:boolean )` — Logical NOT
- `OR` `( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )` — Logical OR of two values or array

## core
- `!` `( value:any variable:any -- )` — Sets variable value (auto-creates if string name)
- `!@` `( value:any variable:any -- value:any )` — Sets variable and returns value
- `@` `( variable:any -- value:any )` — Gets variable value (throws UnknownVariableError if string name is undeclared)
- `~>` `( array:any[] -- options:WordOptions )` — Convert options array to WordOptions. Format: [.key1 val1 .key2 val2]
- `ARRAY?` `( value:any -- boolean:boolean )` — Returns true if value is an array
- `DEFAULT` `( value:any default_value:any -- result:any )` — Returns value or default if value is null/undefined/empty string
- `DEFAULT-RUN` `( value:any forthic:string -- result:any )` — Lazy default: returns value if non-empty, otherwise runs forthic and uses its result. The forthic is only evaluated when needed.
- `DUP` `( a:any -- a:any a:any )` — Duplicates top stack item
- `EMPTY?` `( value:any -- boolean:boolean )` — Returns true if value is null/undefined, an empty string, or a container (array/record) with no entries
- `IF` `( bool:boolean then_value:any else_value:any -- chosen:any )` — Pure value selection: push then_value if bool is truthy, else push else_value. For lazy code execution use IF-RUN; for one-sided side effects use WHEN.
- `IF-RUN` `( bool:boolean then_forthic:string else_forthic:string -- ? )` — Conditional code execution: if bool is truthy run then_forthic, otherwise run else_forthic. Branches are Forthic strings.
- `INTERPOLATE` `( string:string [options:WordOptions] -- result:string )` — Interpolate variables (.name) and return result string. Use \\. to escape literal dots.
- `NOP` `( -- )` — Does nothing (no operation)
- `NULL` `( -- null:null )` — Pushes null onto stack
- `NULL?` `( value:any -- boolean:boolean )` — Returns true if value is null or undefined
- `NUMBER?` `( value:any -- boolean:boolean )` — Returns true if value is a finite number
- `PEEK!` `( -- )` — Prints top of stack and stops execution
- `POP` `( a:any -- )` — Removes top item from stack
- `PRINT` `( value:any [options:WordOptions] -- )` — Print value to stdout. Strings interpolate variables (.name). Non-strings formatted with options. Use \\. to escape literal dots in strings.
- `RECORD?` `( value:any -- boolean:boolean )` — Returns true if value is a plain record (object that is not an array and not null)
- `RUN` `( forthic:string -- ? )` — Run a Forthic string in the current context. Whatever the forthic produces is left on the stack.
- `STACK!` `( -- )` — Prints entire stack (reversed) and stops execution
- `STRING?` `( value:any -- boolean:boolean )` — Returns true if value is a string
- `SWAP` `( a:any b:any -- b:any a:any )` — Swaps top two stack items
- `USE-MODULES` `( names:string[] [options:WordOptions] -- )` — Imports modules by name
- `VARIABLES` `( varnames:string[] -- )` — Creates variables in current module
- `WHEN` `( bool:boolean forthic:string -- ? )` — If bool is truthy run forthic, otherwise do nothing. The forthic argument is always treated as code (executed in current context).

## datetime
- `>DATE` `( item:any -- date:Temporal.PlainDate )` — Convert string or datetime to PlainDate
- `>DATETIME` `( str_or_timestamp:any -- datetime:Temporal.ZonedDateTime )` — Convert string or timestamp to ZonedDateTime
- `>TIME` `( item:any -- time:Temporal.PlainTime )` — Convert string or datetime to PlainTime
- `>TIMESTAMP` `( datetime:Temporal.ZonedDateTime -- timestamp:number )` — Convert datetime to Unix timestamp (seconds)
- `ADD-DAYS` `( date:Temporal.PlainDate num_days:number -- date:Temporal.PlainDate )` — Add days to a date
- `AM` `( time:Temporal.PlainTime -- time:Temporal.PlainTime )` — Convert time to AM (subtract 12 from hour if >= 12)
- `AT` `( date:Temporal.PlainDate time:Temporal.PlainTime -- datetime:Temporal.ZonedDateTime )` — Combine date and time into datetime
- `DATE>STR` `( date:Temporal.PlainDate -- str:string )` — Convert date to YYYY-MM-DD string
- `DAY-OF-WEEK` `( date:Temporal.PlainDate -- day:number )` — Get the day-of-week (1=Monday, 7=Sunday, ISO 8601).
- `DAYS-BETWEEN` `( date1:Temporal.PlainDate date2:Temporal.PlainDate -- num_days:number )` — Get number of days between two dates (date1 - date2)
- `MONTH` `( date:Temporal.PlainDate -- month:number )` — Get the calendar month of a date (1=January, 12=December).
- `NOW` `( -- datetime:Temporal.ZonedDateTime )` — Get current datetime
- `PM` `( time:Temporal.PlainTime -- time:Temporal.PlainTime )` — Convert time to PM (add 12 to hour if < 12)
- `TIME>STR` `( time:Temporal.PlainTime -- str:string )` — Convert time to HH:MM string
- `TIMESTAMP>DATETIME` `( timestamp:number -- datetime:Temporal.ZonedDateTime )` — Convert Unix timestamp (seconds) to datetime
- `TODAY` `( -- date:Temporal.PlainDate )` — Get current date
- `YEAR` `( date:Temporal.PlainDate -- year:number )` — Get the calendar year of a date.

## json
- `>JSON` `( object:any -- json:string )` — Convert object to JSON string
- `JSON>` `( json:string -- object:any )` — Parse JSON string to object

## math
- `-` `( a:number b:number -- difference:number )` — Subtract b from a
- `*` `( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )` — Multiply two numbers or product of array
- `/` `( a:number b:number -- quotient:number )` — Divide a by b
- `+` `( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )` — Add two numbers or sum array
- `>FLOAT` `( a:any -- float:number )` — Convert to float
- `>INT` `( a:any -- int:number )` — Convert to integer (returns length for arrays/objects, 0 for null)
- `ABS` `( n:number -- abs:number )` — Absolute value
- `CEIL` `( n:number -- ceil:number )` — Round up to integer
- `CLAMP` `( value:number min:number max:number -- clamped:number )` — Constrain value to range [min, max]
- `FLOOR` `( n:number -- floor:number )` — Round down to integer
- `FORMAT-FIXED` `( num:number digits:number -- result:string )` — Format number with fixed decimal places
- `MAX` `( a:number b:number -- max:number ) OR ( items:number[] -- max:number )` — Maximum of two numbers or array
- `MAX-OF` `( numbers:number[] -- max:number )` — Maximum of array of numbers. Null/undefined elements are skipped. Returns null for empty/all-null array.
- `MEAN` `( items:any[] -- mean:any )` — Calculate mean of array (handles numbers, strings, objects)
- `MIN` `( a:number b:number -- min:number ) OR ( items:number[] -- min:number )` — Minimum of two numbers or array
- `MIN-OF` `( numbers:number[] -- min:number )` — Minimum of array of numbers. Null/undefined elements are skipped. Returns null for empty/all-null array.
- `MOD` `( m:number n:number -- remainder:number )` — Modulo operation (m % n)
- `PRODUCT` `( numbers:number[] -- product:number )` — Product of array of numbers (1 if empty). Null/undefined elements yield null.
- `RANGE` `( start:number end:number -- numbers:number[] )` — Generate inclusive integer range from start to end (e.g. 1 5 RANGE -> [1,2,3,4,5]). Empty if start > end.
- `ROUND` `( num:number -- int:number )` — Round to nearest integer
- `SQRT` `( n:number -- sqrt:number )` — Square root
- `SUM` `( numbers:number[] -- sum:number )` — Sum of array (explicit)

## record
- `<REC!` `( rec:any value:any field:any -- rec:any )` — Set value in record at field path
- `|REC@` `( records:any field:any -- values:any )` — Map REC@ over array of records
- `DELETE` `( container:any key:any -- container:any )` — Delete key from record or index from array
- `ENTRIES>REC` `( pairs:any[] -- rec:any )` — Build a record from an array of [key, value] pairs. Alias of REC, surfaced for symmetry with REC>ENTRIES.
- `HAS-KEY?` `( rec:any key:any -- bool:boolean )` — Returns true if rec has the given key (own property). Distinct from REC@ NULL == — handles intentional null values correctly.
- `KEYS` `( container:any -- keys:any[] )` — Get keys from record or indices from array
- `MERGE` `( rec1:any rec2:any -- merged:any )` — Shallow merge two records. Keys present in rec2 override rec1.
- `OMIT` `( rec:any keys:any[] -- rec:any )` — Return a new record without the listed keys.
- `PICK` `( rec:any keys:any[] -- rec:any )` — Return a new record containing only the listed keys (missing keys are skipped).
- `REC` `( key_vals:any[] -- rec:any )` — Create record from [[key, val], ...] pairs
- `REC@` `( rec:any field:any -- value:any )` — Get value from record by field or array of fields
- `REC>ENTRIES` `( rec:any -- pairs:any[] )` — Convert a record to an array of [key, value] pairs (sorted by key for stability). Inverse of ENTRIES>REC / REC.
- `VALUES` `( container:any -- values:any[] )` — Get values from record or elements from array

## string
- `/N` `( -- char:string )` — Newline character
- `/T` `( -- char:string )` — Tab character
- `>STR` `( item:any -- string:string )` — Convert item to string
- `ASCII` `( string:string -- result:string )` — Keep only ASCII characters (< 256)
- `CONCAT` `( str1:string str2:string -- result:string ) OR ( arr1:any[] arr2:any[] -- result:any[] ) OR ( strings:string[] -- result:string )` — Concatenate two strings, two arrays, or an array of strings. Dispatches on top-of-stack type.
- `CUT` `( strings:string[] sep:string field:number -- field_values:any[] )` — Split each string on sep and pick the field-th column (bash cut). Out-of-range yields null.
- `ENDS-WITH?` `( str:string suffix:string -- bool:boolean )` — Returns true if str ends with suffix.
- `GREP` `( strings:string[] pattern:string -- matches:string[] )` — Keep only strings matching the regex pattern (bash grep).
- `GREP-V` `( strings:string[] pattern:string -- non_matches:string[] )` — Keep only strings NOT matching the regex pattern (bash grep -v).
- `JOIN` `( strings:string[] sep:string -- result:string )` — Join strings with separator
- `LINES` `( str:string -- lines:string[] )` — Split string on newline. Equivalent to /N SPLIT.
- `LOWERCASE` `( string:string -- result:string )` — Convert string to lowercase
- `RE-MATCH` `( string:string pattern:string -- match:any )` — Match string against regex pattern
- `RE-MATCH-ALL` `( string:string pattern:string -- matches:any[] )` — Find all regex matches in string
- `RE-MATCH?` `( str:string pattern:string -- bool:boolean )` — Returns true if str matches the regex pattern. Predicate-only — does not return the match. (jq's `test`.)
- `RE-REPLACE` `( string:string pattern:string replace:string -- result:string )` — Replace all regex matches of pattern with replace. Same as classic REPLACE behavior.
- `REPLACE` `( string:string text:string replace:string -- result:string )` — Replace all literal occurrences of text with replace. For regex matching use RE-REPLACE.
- `SED` `( strings:string[] pattern:string repl:string -- strings:string[] )` — Apply RE-REPLACE to each string in the array (bash sed s/pattern/repl/g).
- `SPLIT` `( string:string sep:string -- items:any[] )` — Split string by separator
- `STARTS-WITH?` `( str:string prefix:string -- bool:boolean )` — Returns true if str begins with prefix.
- `STRIP` `( string:string -- result:string )` — Trim whitespace from string
- `TRIM-PREFIX` `( str:string prefix:string -- result:string )` — Strip prefix from start of str if present (otherwise return str unchanged).
- `TRIM-SUFFIX` `( str:string suffix:string -- result:string )` — Strip suffix from end of str if present (otherwise return str unchanged).
- `UNLINES` `( lines:string[] -- str:string )` — Join an array of lines with newlines. Equivalent to /N JOIN.
- `UPPERCASE` `( string:string -- result:string )` — Convert string to uppercase

