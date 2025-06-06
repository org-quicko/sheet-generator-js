import * as XLSX from "xlsx";
import { FileUtil } from "./FileUtil";

interface BlockField {
	fieldName: string;
	nullAllowed?: string; // e.g. "Yes" or "No"
	type?: string; // e.g. "string", "number", ...
	minimum?: string;
	maximum?: string;
	minLength?: string;
	maxLength?: string;
	pattern?: string;
	enumValues?: string; // comma-separated
	description?: string;
	examples?: string;
}

interface BlockModel {
	name: string;
	entity: "list" | "table";
	fields: BlockField[];
}

interface SheetModel {
	name: string;
	entity: string;
	blocks: BlockModel[];
}

interface WorkbookModel {
	name: string;
	entity: string;
	sheets: SheetModel[];
}

/**
 * Utility class that reads an Excel file with certain "list"/"table" blocks
 * and generates a JSON Schema with advanced properties.
 *
 * It also deduplicates repeated block definitions in a top-level "definitions" section.
 */
export class ExcelToSchemaGeneratorUtil {
	/**
	 * Main entry point. Reads the given Excel file (by path), parses it
	 * into an internal model, then builds and returns the JSON Schema as an object.
	 * @param excelFilePath Path to the Excel file
	 */
	public static generate(excelFilePath: string): Record<string, any> {
		// 1) Parse the workbook into a model
		const workbookModel = this.parseExcelToModel(excelFilePath);

		// 2) Build the JSON schema from the model
		const schema = this.buildJsonSchema(workbookModel);

		// 3) Deduplicate repeated block definitions
		const definitions = this.deduplicateBlocks(schema);

		// If we found repeated definitions, attach them to the schema
		if (Object.keys(definitions).length > 0) {
			schema.definitions = definitions;
		}

		return schema;
	}

	// -------------------------------------------------------------------------
	// PART 1: PARSE EXCEL → MODEL
	// -------------------------------------------------------------------------

	/**
	 * Reads the Excel file via SheetJS, scanning each sheet row by row.
	 * Discovers blocks labeled "X_list" or "X_table" in the first column.
	 * Builds a WorkbookModel containing sheets, blocks, and fields.
	 */
	private static parseExcelToModel(excelFilePath: string): WorkbookModel {
		const workbookModel: WorkbookModel = {
			name: FileUtil.fileName(excelFilePath),
			entity: "workbook",
			sheets: [],
		};

		// Read the file using sheetjs
		const wb = XLSX.readFile(excelFilePath);

		wb.SheetNames.forEach((sheetName) => {
			const sheet = wb.Sheets[sheetName];
			if (!sheet) return;

			// Convert to an array of arrays for easier row/col iteration
			// { header: 1 } => the first row is row 0, second row is row 1, etc.
			const sheetData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

			const sheetModel: SheetModel = {
				name: sheetName,
				entity: "sheet",
				blocks: [],
			};

			// Parse out "blocks" from the sheet
			const blocks = this.parseBlocksInSheet(sheetData);
			sheetModel.blocks = blocks;

			workbookModel.sheets.push(sheetModel);
		});

		return workbookModel;
	}

	/**
	 * Given the rows of a sheet (array of arrays), scans row by row:
	 * - If the first cell ends with "_list" or "_table", start a new block
	 * - The next row is the "meta-header"
	 * - Subsequent rows are field definitions until a blank row or a new block heading
	 */
	private static parseBlocksInSheet(sheetData: any[][]): BlockModel[] {
		const blocks: BlockModel[] = [];
		let currentRow = 0;
		const lastRow = sheetData.length - 1;

		while (currentRow <= lastRow) {
			const row = sheetData[currentRow] || [];
			const firstCellVal = (row[0] || "").toString().trim();

			if (firstCellVal.endsWith("_list") || firstCellVal.endsWith("_table")) {
				// Start a new block
				const block: BlockModel = {
					name: firstCellVal,
					entity: firstCellVal.endsWith("_list") ? "list" : "table",
					fields: [],
				};

				// Next row => metadata header
				currentRow += 1;
				const metaHeaderRow = sheetData[currentRow] || [];
				const metaCols = this.findMetaColumns(metaHeaderRow);

				// Gather field rows
				currentRow += 1;
				const fields: BlockField[] = [];
				while (currentRow <= lastRow) {
					const dataRow = sheetData[currentRow] || [];

					if (this.isBlankRow(dataRow)) {
						// end of this block
						currentRow += 1;
						break;
					}

					// Check if the first cell is the start of a new block
					const maybeBlockName = (dataRow[0] || "").toString().trim();
					if (maybeBlockName.endsWith("_list") || maybeBlockName.endsWith("_table")) {
						// new block starts => break from this one
						break;
					}

					// This row is a field definition
					const field = this.parseFieldRow(dataRow, metaCols);
					fields.push(field);

					currentRow += 1;
				}

				block.fields = fields;
				blocks.push(block);
			} else {
				currentRow += 1;
			}
		}

		return blocks;
	}

	/**
	 * The "meta-header" row identifies which column index holds "null_allowed", "type", "pattern", etc.
	 */
	private static findMetaColumns(metaHeaderRow: any[]): Record<string, number> {
		const map: Record<string, number> = {};
		metaHeaderRow.forEach((value, index) => {
			const lowerVal = (value || "").toString().trim().toLowerCase();
			if (lowerVal === "null_allowed") map.null_allowed = index;
			else if (lowerVal === "type") map.type = index;
			else if (lowerVal === "minimum") map.minimum = index;
			else if (lowerVal === "maximum") map.maximum = index;
			else if (lowerVal === "minlength") map.minLength = index;
			else if (lowerVal === "maxlength") map.maxLength = index;
			else if (lowerVal === "pattern") map.pattern = index;
			else if (lowerVal === "enum") map.enum = index;
			else if (lowerVal === "description") map.description = index;
			else if (lowerVal === "examples") map.examples = index;
		});
		return map;
	}

	/**
	 * Parses a single field row (e.g., A=fieldName, B=nullAllowed, C=type, D=minimum, E=maximum, etc.)
	 */
	private static parseFieldRow(row: any[], metaCols: Record<string, number>): BlockField {
		const getSafeVal = (colName: string) => {
			const idx = metaCols[colName];
			if (idx === undefined) return "";
			return (row[idx] || "").toString().trim();
		};

		return {
			fieldName: (row[0] || "").toString().trim(),
			nullAllowed: getSafeVal("null_allowed"),
			type: getSafeVal("type"),
			minimum: getSafeVal("minimum"),
			maximum: getSafeVal("maximum"),
			minLength: getSafeVal("minLength"),
			maxLength: getSafeVal("maxLength"),
			pattern: getSafeVal("pattern"),
			enumValues: getSafeVal("enum"),
			description: getSafeVal("description"),
			examples: getSafeVal("examples"),
		};
	}

	/**
	 * Determines if a row is blank (all cells empty).
	 */
	private static isBlankRow(row: any[]): boolean {
		return row.every((cell) => {
			const val = (cell || "").toString().trim();
			return val.length === 0;
		});
	}

	// -------------------------------------------------------------------------
	// PART 2: BUILD JSON SCHEMA (FROM MODEL)
	// -------------------------------------------------------------------------

	/**
	 * Builds the top-level JSON schema from the internal WorkbookModel.
	 */
	private static buildJsonSchema(workbook: WorkbookModel): Record<string, any> {
		const rootSchema: Record<string, any> = {
			$schema: "http://json-schema.org/draft-07/schema#",
			type: "object",
			properties: {
				name: {
					type: "string",
					enum: [workbook.name],
				},
				"@entity": {
					type: "string",
					enum: [workbook.entity],
				},
				sheets: {
					type: "array",
					items: {
						oneOf: workbook.sheets.map((s) => this.buildSheetSchema(s)),
					},
				},
			},
			required: ["name", "@entity", "sheets"],
		};

		return rootSchema;
	}

	/**
	 * Builds the JSON schema for a single SheetModel.
	 */
	private static buildSheetSchema(sheet: SheetModel): Record<string, any> {
		return {
			type: "object",
			properties: {
				name: {
					type: "string",
					enum: [sheet.name],
				},
				"@entity": {
					type: "string",
					enum: [sheet.entity],
				},
				blocks: {
					type: "array",
					items: {
						oneOf: sheet.blocks.map((b) => {
							if (b.entity === "list") return this.buildListBlockSchema(b);
							return this.buildTableBlockSchema(b);
						}),
					},
				},
			},
			required: ["name", "@entity", "blocks"],
		};
	}

	/**
	 * Builds the schema for a "list" block:
	 *   {
	 *     type: "object",
	 *     properties: {
	 *       name: { enum: [blockName] },
	 *       @entity: { enum: ["list"] },
	 *       items: {
	 *         type: "array",
	 *         items: {
	 *           type: "object",
	 *           properties: { fieldName: { ...fieldProps } },
	 *           additionalProperties: false
	 *         }
	 *       }
	 *     },
	 *     required: ["name","@entity","items"]
	 *   }
	 */
	private static buildListBlockSchema(block: BlockModel): Record<string, any> {
		// Collect fields as "properties" in the item object
		const itemProps: Record<string, any> = {};
		for (const bf of block.fields) {
			itemProps[bf.fieldName] = this.buildFieldSchema(bf);
		}

		return {
			type: "object",
			properties: {
				name: { type: "string", enum: [block.name] },
				"@entity": { type: "string", enum: ["list"] },
				items: {
					type: "array",
					items: {
						type: "object",
						properties: itemProps,
						additionalProperties: false,
					},
				},
			},
			required: ["name", "@entity", "items"],
		};
	}

	/**
	 * Builds the schema for a "table" block:
	 * - "header" is an array of strings, each enum-limited to the known column name
	 * - "rows" is an array of arrays, each column with constraints from the field schema
	 */
	private static buildTableBlockSchema(block: BlockModel): Record<string, any> {
		// For the header, we create a fixed array of items: each item is a string enum'd to the field's name
		const headerItems = block.fields.map((f) => ({
			type: "string",
			enum: [f.fieldName],
		}));
		const headerSize = headerItems.length;

		const headerSchema: Record<string, any> = {
			type: "array",
			items: headerItems,
			additionalItems: false,
			minItems: headerSize,
			maxItems: headerSize,
		};

		// For the rows, each row is an array of cells, each cell with constraints from buildFieldSchema
		const columnSchemas = block.fields.map((f) => this.buildFieldSchema(f));
		const rowItemsSchema: Record<string, any> = {
			type: "array",
			items: columnSchemas,
			additionalItems: false,
			minItems: headerSize,
			maxItems: headerSize,
		};

		return {
			type: "object",
			properties: {
				name: { type: "string", enum: [block.name] },
				"@entity": { type: "string", enum: ["table"] },
				header: headerSchema,
				rows: {
					type: "array",
					items: rowItemsSchema,
				},
			},
			required: ["name", "@entity", "header", "rows"],
		};
	}

	/**
	 * Converts a single "BlockField" into a JSON schema snippet.
	 * Handles numeric constraints, string lengths, pattern, enum, description, examples, and nullAllowed.
	 */
	private static buildFieldSchema(bf: BlockField): Record<string, any> {
		const fieldSchema: Record<string, any> = {};

		// Type or [type, "null"]
		if (bf.type) {
			if (bf.nullAllowed && bf.nullAllowed.toLowerCase() === "no") {
				fieldSchema.type = bf.type;
			} else {
				// e.g. ["string", "null"]
				fieldSchema.type = [bf.type, "null"];
			}
		} else {
			// fallback if not specified
			fieldSchema.type = "string";
		}

		// numeric constraints
		if (bf.minimum && !Number.isNaN(Number(bf.minimum))) {
			fieldSchema.minimum = parseFloat(bf.minimum);
		}
		if (bf.maximum && !Number.isNaN(Number(bf.maximum))) {
			fieldSchema.maximum = parseFloat(bf.maximum);
		}

		// string length
		if (bf.minLength && !Number.isNaN(Number(bf.minLength))) {
			fieldSchema.minLength = parseInt(bf.minLength, 10);
		}
		if (bf.maxLength && !Number.isNaN(Number(bf.maxLength))) {
			fieldSchema.maxLength = parseInt(bf.maxLength, 10);
		}

		// pattern
		if (bf.pattern) {
			fieldSchema.pattern = bf.pattern;
		}

		// enum
		if (bf.enumValues) {
			const vals = bf.enumValues.split(/\s*,\s*/);
			fieldSchema.enum = vals;
		}

		// description
		if (bf.description) {
			fieldSchema.description = bf.description;
		}

		// examples
		if (bf.examples) {
			// If you want multiple examples, parse them into an array if needed
			fieldSchema.examples = [bf.examples];
		}

		return fieldSchema;
	}

	// -------------------------------------------------------------------------
	// PART 3: DE-DUPLICATE BLOCK SCHEMAS
	// -------------------------------------------------------------------------

	/**
	 * Walk the final schema, find all block schemas in
	 * "sheets -> items -> oneOf[*] -> properties -> blocks -> items -> oneOf[*]",
	 * detect duplicates, and move them to a top-level "definitions" section
	 * with $ref references.
	 */
	private static deduplicateBlocks(rootSchema: Record<string, any>): Record<string, any> {
		// 1) Find all block schemas
		const blockLocations = this.findAllBlockSchemas(rootSchema);

		// 2) Count usage by canonical JSON
		const usageCount = new Map<string, number>();
		for (const loc of blockLocations) {
			const canon = this.toCanonicalJson(loc.blockSchema);
			usageCount.set(canon, (usageCount.get(canon) || 0) + 1);
		}

		// 3) For repeated definitions, assign a definition name
		const repeatedCanonToDefName = new Map<string, string>();
		for (const [canon, count] of usageCount.entries()) {
			if (count > 1) {
				// extract block name from the schema
				const blockMap = this.fromCanonicalJson(canon);
				const props = blockMap.properties || {};
				const nameProp = props.name || {};
				const blockNameEnum = Array.isArray(nameProp.enum) ? nameProp.enum : [];
				const blockName = blockNameEnum[0] || "Block";
				repeatedCanonToDefName.set(canon, blockName);
			}
		}

		// 4) Build the definitions map
		const definitions: Record<string, any> = {};
		for (const [canon, defName] of repeatedCanonToDefName.entries()) {
			const blockMap = this.fromCanonicalJson(canon);
			definitions[defName] = blockMap;
		}

		// 5) Replace inlined repeated blocks with $ref
		for (const loc of blockLocations) {
			const canon = this.toCanonicalJson(loc.blockSchema);
			if (repeatedCanonToDefName.has(canon)) {
				const defName = repeatedCanonToDefName.get(canon)!;
				// replace with {"$ref":"#/definitions/defName"}
				loc.blocksOneOf[loc.index] = { $ref: `#/definitions/${defName}` };
			}
		}

		return definitions;
	}

	/**
	 * Returns a list of block locations in the schema:
	 * [ { blocksOneOf, index, blockSchema }, ... ]
	 */
	private static findAllBlockSchemas(rootSchema: Record<string, any>): Array<{
		blocksOneOf: Record<string, any>[];
		index: number;
		blockSchema: Record<string, any>;
	}> {
		const results: Array<{
			blocksOneOf: Record<string, any>[];
			index: number;
			blockSchema: Record<string, any>;
		}> = [];

		const props = rootSchema.properties;
		if (!props) return results;

		const { sheets } = props;
		if (!sheets) return results;

		const sheetsItems = sheets.items || {};
		const oneOfSheets = sheetsItems.oneOf;
		if (!Array.isArray(oneOfSheets)) return results;

		for (const sheetSchema of oneOfSheets) {
			const sheetProps = sheetSchema.properties;
			if (!sheetProps) continue;
			const { blocks } = sheetProps;
			if (!blocks) continue;

			const blocksItems = blocks.items || {};
			const blocksOneOfList = blocksItems.oneOf;
			if (!Array.isArray(blocksOneOfList)) continue;

			for (let i = 0; i < blocksOneOfList.length; i += 1) {
				const blockSchema = blocksOneOfList[i];
				results.push({
					blocksOneOf: blocksOneOfList,
					index: i,
					blockSchema,
				});
			}
		}
		return results;
	}

	// -------------------------------------------------------------------------
	// CANONICAL JSON UTILS (to detect duplicates)
	// -------------------------------------------------------------------------

	/**
	 * Produces a canonical JSON representation for stable comparison.
	 * In a production app, you might use a library that sorts object keys, etc.
	 * Here, we do a simple approach with a sorting function.
	 */
	private static toCanonicalJson(obj: any): string {
		return JSON.stringify(this.toTreeMapRecursive(obj));
	}

	/**
	 * Converts the object into a "sorted" structure (TreeMap style),
	 * sorting keys at each level so that JSON.stringify is stable.
	 */
	private static toTreeMapRecursive(value: any): any {
		if (Array.isArray(value)) {
			return value.map((v) => this.toTreeMapRecursive(v));
		}

		if (value && typeof value === "object" && !Array.isArray(value)) {
			// sort keys
			const sortedKeys = Object.keys(value).sort();
			const result: Record<string, any> = {};
			for (const k of sortedKeys) {
				result[k] = this.toTreeMapRecursive(value[k]);
			}
			return result;
		}
		// primitive
		return value;
	}

	private static fromCanonicalJson(jsonStr: string): any {
		return JSON.parse(jsonStr);
	}
}
