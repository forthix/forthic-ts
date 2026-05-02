# json Module

[← Back to Index](../index.md)

JSON serialization, parsing, and formatting operations.

**2 words**

## Categories

- **Conversion**: >JSON, JSON>

## Examples

```forthic
{name: "Alice", age: 30} >JSON
'{"name":"Alice"}' JSON>
```

## Words

### >JSON

**Stack Effect:** `( object:any -- json:string )`

Convert object to JSON string

---

### JSON>

**Stack Effect:** `( json:string -- object:any )`

Parse JSON string to object

---


[← Back to Index](../index.md)
