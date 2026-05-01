import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";

export class JsonModule extends DecoratedModule {
  static {
    registerModuleDoc(JsonModule, `
JSON serialization, parsing, and formatting operations.

## Categories
- Conversion: >JSON, JSON>

## Examples
{name: "Alice", age: 30} >JSON
'{"name":"Alice"}' JSON>
`);
  }

  constructor() {
    super("json");
  }

  @ForthicWord("( object:any -- json:string )", "Convert object to JSON string", ">JSON")
  async to_JSON(object: any) {
    if (object === null || object === undefined) {
      return "null";
    }
    return JSON.stringify(object);
  }

  @ForthicWord("( json:string -- object:any )", "Parse JSON string to object", "JSON>")
  async from_JSON(json: string) {
    if (!json || json.trim() === "") {
      return null;
    }
    return JSON.parse(json);
  }

}
