# sheet-generator

A command-line tool which provides a simple workflow to generate TypeScript objects from JSON schemas. Using this generator, you can generate [sheet objects](https://github.com/org-quicko/sheet-js) and use them in your projects.

### Overview
- This tool automates the generation of sheet objects, thus reducing manual model maintenance and ensuring consistency across your codebase.
- Reads JSON schemas that define fields, validations, and relationships.
- Outputs TypeScript classes from these schemas, complete with decorators.

### Installation
```bash
npm install @org-quicko/sheet-generator
```

##### Prerequisites
- Node.js: v20.0.0 or higher

### Configuration and setup

- Add the following script to your package.json:
```json
{ 
  "scripts": {
    "generate": "schema-to-objects --input <path-to-directory-or-file-having json-schema> --output <path-to-directory-for-generating-objects>"
  }
}
```

### A typical workflow
- Define your model in a JSON schema describing your data structures (sheets, rows, columns, etc.) and put that schema in your codebase in an appropriate folder.

- Now you can generate TypeScript classes from the JSON schema:
```bash
npm run generate
```

TypeScript classes will be generated in your output path. Now you can import the generated classes into your project as needed.

Ensure your IDE recognizes the generated objects directory as part of your project's source paths to seamlessly integrate the generated classes.

### Available commands

- `excel-to-schema`
    - Generates a JSON schema from a specified Excel file
    - Alias: `e2s`
```bash
excel-to-schema --input <path-to-excel-file-or-directory> --output <path-to-output-directory>
```

- `json-to-schema`
    - Generates a JSON Schema from a specified JSON file.
    - Alias: `j2s`
```bash
json-to-schema --input <path-to-json-file-or-directory> --output <path-to-output-directory>
```
- `schema-to-objects`
    - Generates TypeScript classes from a specified JSON Schema file.
    - Alias: `s2o`
```bash
schema-to-objects --input <path-to-schema-file-or-directory> --output <path-to-output-directory>
```