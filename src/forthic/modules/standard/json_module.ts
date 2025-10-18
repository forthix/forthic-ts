import { DecoratedModule, Word, registerModuleDoc } from "../../decorators/word.js";

export class JsonModule extends DecoratedModule {
  static {
    registerModuleDoc(JsonModule, `
JSON serialization, parsing, and formatting operations.

## Categories
- Conversion: >JSON, JSON>
- Formatting: JSON-PRETTIFY

## Examples
{name: "Alice", age: 30} >JSON
'{"name":"Alice"}' JSON>
'{"a":1}' JSON-PRETTIFY
`);
  }

  constructor() {
    super("json");
  }

  @Word("( object:any -- json:string )", "Convert object to JSON string", ">JSON")
  async to_JSON(object: any) {
    if (object === null || object === undefined) {
      return "null";
    }
    return JSON.stringify(object);
  }

  @Word("( json:string -- object:any )", "Parse JSON string to object", "JSON>")
  async from_JSON(json: string) {
    if (!json || json.trim() === "") {
      return null;
    }
    return JSON.parse(json);
  }

  @Word("( json:string -- pretty:string )", "Format JSON with 2-space indentation", "JSON-PRETTIFY")
  async JSON_PRETTIFY(json: string) {
    if (!json || json.trim() === "") {
      return "";
    }
    const obj = JSON.parse(json);
    return JSON.stringify(obj, null, 2);
  }
}
