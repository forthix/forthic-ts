import { DecoratedModule, Word } from "../decorators/word";

/**
 * JsonModule - JSON serialization and parsing
 *
 * Words:
 * - >JSON: Convert object/array to JSON string
 * - JSON>: Parse JSON string to object/array
 * - JSON-PRETTIFY: Format JSON string with indentation
 */
export class JsonModule extends DecoratedModule {
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
