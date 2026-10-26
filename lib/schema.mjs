// A small JSON Schema (2020-12) validator for the subset Thinkaloud's schemas use, so there are no
// runtime dependencies. Supported: type, enum, const, required, properties, additionalProperties,
// items, minItems, minLength, pattern, minimum, maximum, $ref (local "#/$defs/..."), allOf, if/then.
// Any other keyword throws, so a schema can't silently rely on something that isn't checked.

const KNOWN = new Set([
  '$schema', '$id', '$defs', 'title', 'description',
  'type', 'enum', 'const', 'required', 'properties', 'additionalProperties', 'items',
  'minItems', 'minLength', 'pattern', 'minimum', 'maximum', '$ref', 'allOf', 'if', 'then',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  return actual === type || (type === 'number' && actual === 'integer');
}

// Returns a list of errors ("path: message"); an empty list means the value is valid.
export function validate(value, schema, root = schema, at = '$') {
  const errors = [];
  for (const key of Object.keys(schema)) {
    if (!KNOWN.has(key)) throw new Error(`schema keyword not supported: ${key} (at ${at})`);
  }
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, '');
    if (!root.$defs?.[name]) throw new Error(`unknown $ref ${schema.$ref}`);
    errors.push(...validate(value, root.$defs[name], root, at));
  }
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => matchesType(value, t))) {
      return [...errors, `${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`];
    }
  }
  if ('const' in schema && value !== schema.const) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${at}: doesn't match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: needs ${schema.minItems}+ items`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(v, schema.items, root, `${at}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${at}: missing ${key}`);
    }
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) errors.push(...validate(v, sub, root, `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected property ${key}`);
    }
  }
  for (const sub of schema.allOf ?? []) errors.push(...validate(value, sub, root, at));
  if (schema.if && schema.then && validate(value, schema.if, root, at).length === 0) {
    errors.push(...validate(value, schema.then, root, at));
  }
  return errors;
}
