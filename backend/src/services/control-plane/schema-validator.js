const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

export function validateJsonSchema(schema, value, options = {}) {
  const errors = [];
  validateSchemaShape(schema, options.schemaName ?? 'schema');
  validateAgainstSchema({
    schema,
    value,
    path: options.path ?? '$',
    errors,
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function assertJsonSchema(schema, value, options = {}) {
  const result = validateJsonSchema(schema, value, options);

  if (!result.ok) {
    const error = new Error(result.errors.map((entry) => entry.message).join('; '));
    error.code = options.code ?? 'JSON_SCHEMA_VALIDATION_FAILED';
    error.status = 400;
    error.validationErrors = result.errors;
    throw error;
  }

  return value;
}

export function validateSchemaShape(schema, schemaName = 'schema') {
  if (!isPlainObject(schema)) {
    throw schemaError(`${schemaName} must be a JSON schema object.`);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    for (const type of types) {
      if (!SUPPORTED_TYPES.has(type)) {
        throw schemaError(`${schemaName} uses unsupported JSON schema type "${type}".`);
      }
    }
  }

  if (schema.properties !== undefined && !isPlainObject(schema.properties)) {
    throw schemaError(`${schemaName}.properties must be an object.`);
  }

  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    throw schemaError(`${schemaName}.required must be an array.`);
  }

  if (schema.items !== undefined) {
    validateSchemaShape(schema.items, `${schemaName}.items`);
  }

  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    validateSchemaShape(child, `${schemaName}.properties.${key}`);
  }

  return true;
}

function validateAgainstSchema({ schema, value, path, errors }) {
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, message: `${path} must equal ${JSON.stringify(schema.const)}.` });
    return;
  }

  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) {
    errors.push({ path, message: `${path} must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(', ')}.` });
    return;
  }

  if (schema.type !== undefined && !matchesType(schema.type, value)) {
    errors.push({ path, message: `${path} must be ${formatType(schema.type)}.` });
    return;
  }

  if (schema.anyOf) {
    const passed = schema.anyOf.some((candidate) => validateJsonSchema(candidate, value).ok);
    if (!passed) {
      errors.push({ path, message: `${path} must match at least one allowed schema.` });
    }
    return;
  }

  if (schema.oneOf) {
    const passCount = schema.oneOf.filter((candidate) => validateJsonSchema(candidate, value).ok).length;
    if (passCount !== 1) {
      errors.push({ path, message: `${path} must match exactly one allowed schema.` });
    }
    return;
  }

  if (schema.type === 'object' || (schema.properties && isPlainObject(value))) {
    validateObject({ schema, value, path, errors });
  }

  if (schema.type === 'array' || Array.isArray(value)) {
    validateArray({ schema, value, path, errors });
  }

  if (typeof value === 'string') {
    validateString({ schema, value, path, errors });
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    validateNumber({ schema, value, path, errors });
  }
}

function validateObject({ schema, value, path, errors }) {
  if (!isPlainObject(value)) {
    return;
  }

  const required = schema.required ?? [];
  for (const key of required) {
    if (value[key] === undefined) {
      errors.push({ path: `${path}.${key}`, message: `${path}.${key} is required.` });
    }
  }

  for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
    if (value[key] !== undefined) {
      validateAgainstSchema({
        schema: childSchema,
        value: value[key],
        path: `${path}.${key}`,
        errors,
      });
    }
  }

  if (schema.additionalProperties === false) {
    const known = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) {
      if (!known.has(key)) {
        errors.push({ path: `${path}.${key}`, message: `${path}.${key} is not allowed.` });
      }
    }
  } else if (isPlainObject(schema.additionalProperties)) {
    const known = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) {
      if (!known.has(key)) {
        validateAgainstSchema({
          schema: schema.additionalProperties,
          value: value[key],
          path: `${path}.${key}`,
          errors,
        });
      }
    }
  }
}

function validateArray({ schema, value, path, errors }) {
  if (!Array.isArray(value)) {
    return;
  }

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push({ path, message: `${path} must contain at least ${schema.minItems} item(s).` });
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push({ path, message: `${path} must contain at most ${schema.maxItems} item(s).` });
  }

  if (schema.items) {
    value.forEach((entry, index) => {
      validateAgainstSchema({
        schema: schema.items,
        value: entry,
        path: `${path}[${index}]`,
        errors,
      });
    });
  }
}

function validateString({ schema, value, path, errors }) {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({ path, message: `${path} must contain at least ${schema.minLength} character(s).` });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({ path, message: `${path} must contain at most ${schema.maxLength} character(s).` });
  }

  if (schema.pattern !== undefined) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors.push({ path, message: `${path} must match pattern ${schema.pattern}.` });
    }
  }
}

function validateNumber({ schema, value, path, errors }) {
  if (schema.type === 'integer' && !Number.isInteger(value)) {
    errors.push({ path, message: `${path} must be an integer.` });
  }

  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({ path, message: `${path} must be at least ${schema.minimum}.` });
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({ path, message: `${path} must be at most ${schema.maximum}.` });
  }
}

function matchesType(type, value) {
  if (Array.isArray(type)) {
    return type.some((entry) => matchesType(entry, value));
  }

  switch (type) {
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
}

function formatType(type) {
  return Array.isArray(type) ? type.join(' or ') : type;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaError(message) {
  const error = new Error(message);
  error.code = 'INVALID_JSON_SCHEMA';
  error.status = 400;
  return error;
}
