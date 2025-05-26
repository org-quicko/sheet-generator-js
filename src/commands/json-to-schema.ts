#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import * as fs from 'fs';
import path from 'path';
import { JsonToSchemaGeneratorUtil } from '../utils/JsonToSchemaGeneratorUtil.js';

// Configure CLI command
const jsonToSchemaProgram = new Command();

jsonToSchemaProgram
    .name('json-to-schema')
    .alias('j2s')
    .description('Generate JSON schema from JSON file or directory')
    .version('1.0.0')
    .requiredOption('-i, --input <path>', 'Input JSON file or directory')
    .requiredOption('-o, --output <path>', 'Output directory for generated schema')
    .action(async (options) => {
        try {
            const inputPath = path.resolve(options.input);
            const outputDir = path.resolve(options.output);

            // Check if input exists
            if (!fs.existsSync(inputPath)) {
                console.error(`Error: Input path "${inputPath}" does not exist.`);
                process.exit(1);
            }

            // Create output directory if needed
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const processFile = (inputFile: string, relativeOutputPath: string) => {
                if (!inputFile.endsWith('.json')) {
                    console.error(`Error: Input file ${inputFile} must be a JSON file (.json)`);
                    return; // Skip non-JSON files
                }

                try {
                    // Read and parse JSON file
                    const jsonContent = fs.readFileSync(inputFile, 'utf-8');
                    const data = JSON.parse(jsonContent);

                    // Generate schema from JSON
                    const schema = JsonToSchemaGeneratorUtil.generate(data);

                    // Write schema to output file
                    const baseName = path.basename(inputFile, '.json');
                    const schemaFileName = `${baseName}.schema.json`;
                    const fullOutputPath = path.join(outputDir, relativeOutputPath, schemaFileName);

                     // Ensure the directory structure exists
                     const directory = path.dirname(fullOutputPath);
                    if (!fs.existsSync(directory)) {
                        fs.mkdirSync(directory, { recursive: true });
                    }


                    fs.writeFileSync(fullOutputPath, JSON.stringify(schema, null, 2));
                    console.log(`Schema generated successfully: ${fullOutputPath}`);
                } catch (error) {
                    console.error(`Error during schema generation for ${inputFile}:`, error);
                    // Don't exit; continue with other files if processing a directory.
                }
            };


            if (fs.lstatSync(inputPath).isDirectory()) {
                const processDirectory = (directory: string, relativePath: string = "") => {
                    fs.readdirSync(directory).forEach(file => {
                        const fullPath = path.join(directory, file);
                        const stat = fs.lstatSync(fullPath);

                        if (stat.isDirectory()) {
                            processDirectory(fullPath, path.join(relativePath, file));
                        } else if (stat.isFile()) {
                            processFile(fullPath, relativePath);
                        }
                    });
                };
                processDirectory(inputPath);

            } else {
                processFile(inputPath, ""); // single file
            }


        } catch (error) {
            console.error('Error during schema generation:', error);
            process.exit(1);
        }
    });

// Parse CLI arguments
jsonToSchemaProgram.parse(process.argv);